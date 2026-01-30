import { Index } from 'flexsearch';

export type SearchData = {
  codepoint: number;
  text: string;
};

export type WorkerMessage =
  | { type: 'build'; data: SearchData[] }
  | { type: 'import'; exported: Record<string, string> }
  | { type: 'search'; query: string; limit: number };

export type WorkerResponse =
  | { type: 'ready'; exported: Record<string, string> }
  | { type: 'imported' }
  | { type: 'results'; codepoints: number[] }
  | { type: 'error'; message: string };

let index: Index | null = null;

function buildIndex(data: SearchData[]): Index {
  const idx = new Index({ tokenize: 'full', cache: true });
  for (const item of data) {
    idx.add(item.codepoint, item.text);
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

function importIndex(exported: Record<string, string>): Index {
  const idx = new Index({ tokenize: 'full', cache: true });
  for (const [key, value] of Object.entries(exported)) {
    idx.import(key, value);
  }
  return idx;
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  try {
    switch (msg.type) {
      case 'build': {
        index = buildIndex(msg.data);
        const exported = exportIndex(index);
        self.postMessage({ type: 'ready', exported } satisfies WorkerResponse);
        break;
      }
      case 'import': {
        index = importIndex(msg.exported);
        self.postMessage({ type: 'imported' } satisfies WorkerResponse);
        break;
      }
      case 'search': {
        if (!index) {
          self.postMessage({ type: 'results', codepoints: [] } satisfies WorkerResponse);
          return;
        }
        const results = index.search(msg.query, { limit: msg.limit });
        self.postMessage({ type: 'results', codepoints: results as number[] } satisfies WorkerResponse);
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
