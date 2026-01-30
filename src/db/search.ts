import { isNotNull, inArray } from 'drizzle-orm';
import { getDb, schema } from './client-browser';
import type { SearchData, WorkerMessage, WorkerResponse } from './search.worker';
import SearchWorker from './search.worker?worker';

const IDB_NAME = 'unicode-viewer-cache';
const IDB_STORE = 'db-cache';
const SEARCH_INDEX_KEY = 'flexsearch-index';
const SEARCH_INDEX_VERSION_KEY = 'flexsearch-version';
const SEARCH_NAMES_KEY = 'flexsearch-names';

let worker: Worker | null = null;
let workerReady = false;
let initPromise: Promise<void> | null = null;
let pendingSearches: Map<string, { resolve: (results: number[]) => void; reject: (err: Error) => void }> = new Map();
let searchIdCounter = 0;
let readyListeners: (() => void)[] = [];

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

// Load search data using Drizzle ORM
async function loadSearchDataFromDb(): Promise<SearchData[]> {
  const db = await getDb();

  // Get all characters with names
  const chars = await db
    .select({
      codepoint: schema.characters.codepoint,
      name: schema.characters.name,
    })
    .from(schema.characters)
    .where(isNotNull(schema.characters.name));

  // Get Unihan properties for search (Japanese readings + definitions)
  const unihanProps = await db
    .select({
      codepoint: schema.unihanProperties.codepoint,
      value: schema.unihanProperties.value,
    })
    .from(schema.unihanProperties)
    .where(inArray(schema.unihanProperties.property, ['kJapaneseKun', 'kJapaneseOn', 'kDefinition']));

  // Get CLDR annotations for search
  const cldrAnnotations = await db
    .select({
      codepoint: schema.cldrAnnotations.codepoint,
      keywords: schema.cldrAnnotations.keywords,
    })
    .from(schema.cldrAnnotations);

  // Group Unihan values by codepoint
  const unihanMap = new Map<number, string[]>();
  for (const r of unihanProps) {
    const existing = unihanMap.get(r.codepoint) || [];
    existing.push(r.value);
    unihanMap.set(r.codepoint, existing);
  }

  // Map CLDR annotations by codepoint
  const cldrMap = new Map<number, string>();
  for (const a of cldrAnnotations) {
    cldrMap.set(a.codepoint, a.keywords);
  }

  // Build search data
  const searchData: SearchData[] = [];
  const seenCodepoints = new Set<number>();

  for (const char of chars) {
    const unihanValues = unihanMap.get(char.codepoint);
    const cldrKeywords = cldrMap.get(char.codepoint);
    const text = [char.name, unihanValues?.join(' '), cldrKeywords].filter(Boolean).join(' ');
    if (text) {
      searchData.push({
        codepoint: char.codepoint,
        name: char.name ?? '',
        text,
      });
      seenCodepoints.add(char.codepoint);
    }
  }

  // Add characters that only have Unihan properties (no name)
  for (const [codepoint, values] of unihanMap) {
    if (!seenCodepoints.has(codepoint)) {
      const cldrKeywords = cldrMap.get(codepoint);
      const text = [values.join(' '), cldrKeywords].filter(Boolean).join(' ');
      searchData.push({ codepoint, name: '', text });
      seenCodepoints.add(codepoint);
    }
  }

  // Add characters that only have CLDR annotations (no name, no Unihan)
  for (const [codepoint, keywords] of cldrMap) {
    if (!seenCodepoints.has(codepoint)) {
      searchData.push({ codepoint, name: '', text: keywords });
    }
  }

  return searchData;
}

function postToWorker(msg: WorkerMessage): void {
  worker?.postMessage(msg);
}

function notifyReady(): void {
  for (const listener of readyListeners) {
    listener();
  }
  readyListeners = [];
}

function handleWorkerMessage(e: MessageEvent<WorkerResponse>): void {
  const msg = e.data;

  switch (msg.type) {
    case 'ready':
    case 'imported':
      workerReady = true;
      notifyReady();
      break;
    case 'results':
      // Resolve pending search (using searchIdCounter trick not needed for single search)
      for (const [, pending] of pendingSearches) {
        pending.resolve(msg.codepoints);
      }
      pendingSearches.clear();
      break;
    case 'error':
      for (const [, pending] of pendingSearches) {
        pending.reject(new Error(msg.message));
      }
      pendingSearches.clear();
      break;
  }
}

async function initializeWorker(): Promise<void> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    worker = new SearchWorker();
    worker.onmessage = handleWorkerMessage;

    const currentVersion = __DB_VERSION__;

    // Dev mode: skip cache, always rebuild
    if (import.meta.env.DEV) {
      console.log('[Search] Dev mode, building index in worker...');
      const data = await loadSearchDataFromDb();

      await new Promise<void>((resolve) => {
        const originalHandler = worker!.onmessage;
        worker!.onmessage = (e: MessageEvent<WorkerResponse>) => {
          if (e.data.type === 'ready') {
            workerReady = true;
            worker!.onmessage = originalHandler;
            resolve();
          }
        };
        postToWorker({ type: 'build', data });
      });

      console.log(`[Search] Index built with ${data.length} entries`);
      return;
    }

    // Try to load cached index from IndexedDB
    try {
      const idb = await openIDB();
      const cachedVersion = await idbGet<string>(idb, SEARCH_INDEX_VERSION_KEY);
      const cachedData = await idbGet<Record<string, string>>(idb, SEARCH_INDEX_KEY);
      const cachedNames = await idbGet<Record<number, string>>(idb, SEARCH_NAMES_KEY);

      if (cachedData && cachedNames && cachedVersion === currentVersion) {
        console.log(`[Search] Cache hit (version: ${currentVersion}), importing in worker...`);

        await new Promise<void>((resolve) => {
          const originalHandler = worker!.onmessage;
          worker!.onmessage = (e: MessageEvent<WorkerResponse>) => {
            if (e.data.type === 'imported') {
              workerReady = true;
              worker!.onmessage = originalHandler;
              resolve();
            }
          };
          postToWorker({ type: 'import', exported: cachedData, names: cachedNames });
        });

        idb.close();
        return;
      }

      console.log(`[Search] Cache miss (cached: ${cachedVersion}, current: ${currentVersion}), building in worker...`);

      // Build index from DB
      const data = await loadSearchDataFromDb();

      const { exported, names } = await new Promise<{ exported: Record<string, string>; names: Record<number, string> }>((resolve) => {
        const originalHandler = worker!.onmessage;
        worker!.onmessage = (e: MessageEvent<WorkerResponse>) => {
          if (e.data.type === 'ready') {
            workerReady = true;
            worker!.onmessage = originalHandler;
            resolve({ exported: e.data.exported, names: e.data.names });
          }
        };
        postToWorker({ type: 'build', data });
      });

      console.log(`[Search] Index built with ${data.length} entries`);

      // Cache to IndexedDB
      await idbPut(idb, SEARCH_INDEX_KEY, exported);
      await idbPut(idb, SEARCH_NAMES_KEY, names);
      await idbPut(idb, SEARCH_INDEX_VERSION_KEY, currentVersion);
      console.log(`[Search] Cached (version: ${currentVersion})`);

      idb.close();
    } catch (e) {
      // IndexedDB failed, build without caching
      console.warn('[Search] IndexedDB unavailable, building without cache:', e);
      const data = await loadSearchDataFromDb();

      await new Promise<void>((resolve) => {
        const originalHandler = worker!.onmessage;
        worker!.onmessage = (ev: MessageEvent<WorkerResponse>) => {
          if (ev.data.type === 'ready') {
            workerReady = true;
            worker!.onmessage = originalHandler;
            resolve();
          }
        };
        postToWorker({ type: 'build', data });
      });
    }
  })();

  return initPromise;
}

export async function searchCharacters(query: string, limit = 100): Promise<number[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  await initializeWorker();

  return new Promise((resolve, reject) => {
    const id = String(++searchIdCounter);
    pendingSearches.set(id, { resolve, reject });
    postToWorker({ type: 'search', query: query.trim(), limit });
  });
}

// Pre-initialize the worker (can be called early to start building in background)
export function preloadSearchIndex(): void {
  initializeWorker().catch(console.error);
}

// Check if search index is ready
export function isSearchIndexReady(): boolean {
  return workerReady;
}

// Subscribe to be notified when search index becomes ready
export function onSearchIndexReady(callback: () => void): () => void {
  if (workerReady) {
    callback();
    return () => {};
  }
  readyListeners.push(callback);
  return () => {
    readyListeners = readyListeners.filter(l => l !== callback);
  };
}
