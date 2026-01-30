import { Index } from 'flexsearch';

export type SearchData = {
  codepoint: number;
  name: string;  // Character name for ranking
  text: string;  // Full searchable text (name + readings + definition)
};

export type WorkerMessage =
  | { type: 'build'; data: SearchData[] }
  | { type: 'import'; exported: Record<string, string>; names: Record<number, string> }
  | { type: 'search'; query: string; limit: number };

export type WorkerResponse =
  | { type: 'ready'; exported: Record<string, string>; names: Record<number, string> }
  | { type: 'imported' }
  | { type: 'results'; codepoints: number[] }
  | { type: 'error'; message: string };

let index: Index | null = null;
// Store names for ranking (codepoint -> name)
let nameMap: Map<number, string> = new Map();

function buildIndex(data: SearchData[]): Index {
  const idx = new Index({ tokenize: 'full', cache: true });
  nameMap.clear();
  for (const item of data) {
    idx.add(item.codepoint, item.text);
    if (item.name) {
      nameMap.set(item.codepoint, item.name);
    }
  }
  return idx;
}

function exportIndex(idx: Index): Record<string, string> {
  const exported: Record<string, string> = {};
  idx.export((key, data) => {
    exported[key] = data as string;
  });
  return exported;
}

function exportNames(): Record<number, string> {
  const names: Record<number, string> = {};
  for (const [cp, name] of nameMap) {
    names[cp] = name;
  }
  return names;
}

function importIndex(exported: Record<string, string>): Index {
  const idx = new Index({ tokenize: 'full', cache: true });
  for (const [key, value] of Object.entries(exported)) {
    idx.import(key, value);
  }
  return idx;
}

function importNames(names: Record<number, string>): void {
  nameMap.clear();
  for (const [cp, name] of Object.entries(names)) {
    nameMap.set(Number(cp), name);
  }
}

// Check if character is a word boundary (space, hyphen, or string boundary)
function isWordBoundary(str: string, index: number): boolean {
  if (index < 0 || index >= str.length) return true;
  const char = str[index];
  return char === ' ' || char === '-';
}

// Calculate ranking score for a result
function calculateScore(codepoint: number, query: string): number {
  const name = nameMap.get(codepoint);
  if (!name) return 0;

  const upperQuery = query.toUpperCase();
  const upperName = name.toUpperCase();

  let matchScore = 0;

  // Exact match (highest priority)
  if (upperName === upperQuery) {
    matchScore = 1000;
  } else {
    // Find all occurrences and take the best match
    let idx = 0;
    while (idx <= upperName.length - upperQuery.length) {
      const foundIdx = upperName.indexOf(upperQuery, idx);
      if (foundIdx === -1) break;

      const beforeIsWordBoundary = isWordBoundary(upperName, foundIdx - 1);
      const afterIsWordBoundary = isWordBoundary(upperName, foundIdx + upperQuery.length);

      let currentScore = 0;
      if (foundIdx === 0 && afterIsWordBoundary) {
        // Query is complete word at start: "FISH CAKE" for query "FISH"
        currentScore = 600;
      } else if (beforeIsWordBoundary && afterIsWordBoundary) {
        // Query is complete word somewhere: "POLE AND FISH" for query "FISH"
        currentScore = 400;
      } else if (foundIdx === 0) {
        // Prefix match (compound word): "FISHEYE" for query "FISH"
        currentScore = 200;
      } else if (beforeIsWordBoundary) {
        // Word starts with query but not complete: "CAT-FISHING" for query "FISH"
        currentScore = 150;
      } else {
        // Substring match: "CATFISH" for query "FISH"
        currentScore = 50;
      }

      matchScore = Math.max(matchScore, currentScore);
      idx = foundIdx + 1;
    }
  }

  // Shorter names get bonus (prefer SUSHI over TSUTSUSHIMU)
  // Max bonus: 100 for very short names, decreasing as name gets longer
  const lengthBonus = Math.max(0, 100 - name.length);

  return matchScore + lengthBonus;
}

// Rank search results by relevance
function rankResults(codepoints: number[], query: string): number[] {
  const scored = codepoints.map(cp => ({
    codepoint: cp,
    score: calculateScore(cp, query),
  }));

  // Sort by score descending, then by codepoint ascending for stability
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.codepoint - b.codepoint;
  });

  return scored.map(s => s.codepoint);
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  try {
    switch (msg.type) {
      case 'build': {
        index = buildIndex(msg.data);
        const exported = exportIndex(index);
        const names = exportNames();
        self.postMessage({ type: 'ready', exported, names } satisfies WorkerResponse);
        break;
      }
      case 'import': {
        index = importIndex(msg.exported);
        importNames(msg.names);
        self.postMessage({ type: 'imported' } satisfies WorkerResponse);
        break;
      }
      case 'search': {
        if (!index) {
          self.postMessage({ type: 'results', codepoints: [] } satisfies WorkerResponse);
          return;
        }
        // Get more results than needed for ranking, then trim after sorting
        const rawResults = index.search(msg.query, { limit: msg.limit * 3 });
        const ranked = rankResults(rawResults as number[], msg.query);
        self.postMessage({ type: 'results', codepoints: ranked.slice(0, msg.limit) } satisfies WorkerResponse);
        break;
      }
    }
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    } satisfies WorkerResponse);
  }
};
