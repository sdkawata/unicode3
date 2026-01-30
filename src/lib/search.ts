import { Index } from 'flexsearch';
import { getSqlite } from '../db/client-browser';

const IDB_NAME = 'unicode-viewer-cache';
const IDB_STORE = 'db-cache';
const SEARCH_INDEX_KEY = 'flexsearch-index';
const SEARCH_INDEX_VERSION_KEY = 'flexsearch-version';

let searchIndex: Index | null = null;
let initPromise: Promise<Index> | null = null;

// IndexedDB helpers
function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(IDB_STORE);
    };
  });
}

function idbGet<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const request = tx.objectStore(IDB_STORE).get(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function idbPut(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const request = tx.objectStore(IDB_STORE).put(value, key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

type SearchData = { codepoint: number; name: string | null; readings: string | null };

async function loadSearchDataFromDb(): Promise<SearchData[]> {
  const sqlite = await getSqlite();
  const stmt = sqlite.prepare(`
    SELECT c.codepoint, c.name,
           GROUP_CONCAT(CASE WHEN u.property IN ('kJapaneseKun', 'kJapaneseOn') THEN u.value END, ' ') as readings
    FROM characters c
    LEFT JOIN unihan_properties u ON c.codepoint = u.codepoint
    WHERE c.name IS NOT NULL OR u.property IS NOT NULL
    GROUP BY c.codepoint
  `);

  const results: SearchData[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as SearchData;
    results.push(row);
  }
  stmt.free();
  return results;
}

function buildIndex(data: SearchData[]): Index {
  // tokenize: "full" enables complete substring matching
  const index = new Index({ tokenize: 'full', cache: true });

  for (const row of data) {
    const text = [row.name, row.readings].filter(Boolean).join(' ');
    if (text) {
      index.add(row.codepoint, text);
    }
  }

  return index;
}

async function exportIndex(index: Index): Promise<Record<string, string>> {
  const exported: Record<string, string> = {};
  index.export((key, data) => {
    exported[key] = data as string;
  });
  return exported;
}

function importIndex(data: Record<string, string>): Index {
  const index = new Index({ tokenize: 'full', cache: true });
  for (const [key, value] of Object.entries(data)) {
    index.import(key, value);
  }
  return index;
}

export async function getSearchIndex(): Promise<Index> {
  if (searchIndex) {
    return searchIndex;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const currentVersion = __DB_VERSION__;

    // Dev mode: skip cache, always rebuild
    if (import.meta.env.DEV) {
      console.log('[Search] Dev mode, building index from DB...');
      const data = await loadSearchDataFromDb();
      searchIndex = buildIndex(data);
      console.log(`[Search] Index built with ${data.length} entries`);
      return searchIndex;
    }

    // Try to load cached index from IndexedDB
    try {
      const idb = await openIDB();
      const cachedVersion = await idbGet<string>(idb, SEARCH_INDEX_VERSION_KEY);
      const cachedData = await idbGet<Record<string, string>>(idb, SEARCH_INDEX_KEY);

      if (cachedData && cachedVersion === currentVersion) {
        console.log(`[Search] Cache hit (version: ${currentVersion})`);
        searchIndex = importIndex(cachedData);
        idb.close();
        return searchIndex;
      }

      console.log(`[Search] Cache miss (cached: ${cachedVersion}, current: ${currentVersion}), building...`);

      // Build index from DB
      const data = await loadSearchDataFromDb();
      searchIndex = buildIndex(data);
      console.log(`[Search] Index built with ${data.length} entries`);

      // Cache to IndexedDB
      const exported = await exportIndex(searchIndex);
      await idbPut(idb, SEARCH_INDEX_KEY, exported);
      await idbPut(idb, SEARCH_INDEX_VERSION_KEY, currentVersion);
      console.log(`[Search] Cached (version: ${currentVersion})`);

      idb.close();
      return searchIndex;
    } catch (e) {
      // IndexedDB failed, build without caching
      console.warn('[Search] IndexedDB unavailable, building without cache:', e);
      const data = await loadSearchDataFromDb();
      searchIndex = buildIndex(data);
      return searchIndex;
    }
  })();

  return initPromise;
}

export async function searchCharacters(query: string, limit = 100): Promise<number[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const index = await getSearchIndex();
  const results = index.search(query.trim(), { limit });
  return results as number[];
}
