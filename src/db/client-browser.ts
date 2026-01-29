import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase } from 'sql.js';
import { drizzle } from 'drizzle-orm/sql-js';
import * as schema from './schema';

type DbInstance = ReturnType<typeof drizzle<typeof schema>>;

let dbInstance: DbInstance | null = null;
let sqliteInstance: SqlJsDatabase | null = null;
let initPromise: Promise<DbInstance> | null = null;

const IDB_NAME = 'unicode-viewer-cache';
const IDB_STORE = 'db-cache';
const CACHE_KEY = 'unicode-db';
const VERSION_KEY = 'unicode-db-version';

// Simple IndexedDB helpers
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

async function getCachedDbBuffer(): Promise<ArrayBuffer> {
  const currentVersion = __DB_VERSION__;

  try {
    const idb = await openIDB();
    const cachedVersion = await idbGet<string>(idb, VERSION_KEY);
    const cachedData = await idbGet<ArrayBuffer>(idb, CACHE_KEY);

    if (cachedData && cachedVersion === currentVersion) {
      console.log(`[DB] Cache hit (version: ${currentVersion})`);
      idb.close();
      return cachedData;
    }

    console.log(`[DB] Cache miss (cached: ${cachedVersion}, current: ${currentVersion}), downloading...`);

    const response = await fetch(`${import.meta.env.BASE_URL}unicode.db`);
    if (!response.ok) {
      throw new Error(`Failed to fetch database: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();

    // Save to IndexedDB
    await idbPut(idb, CACHE_KEY, buffer);
    await idbPut(idb, VERSION_KEY, currentVersion);
    console.log(`[DB] Cached (version: ${currentVersion})`);

    idb.close();
    return buffer;
  } catch (e) {
    // IndexedDB failed, fall back to direct fetch
    console.warn('[DB] IndexedDB unavailable, fetching directly:', e);
    const response = await fetch(`${import.meta.env.BASE_URL}unicode.db`);
    if (!response.ok) {
      throw new Error(`Failed to fetch database: ${response.status}`);
    }
    return response.arrayBuffer();
  }
}

export async function getDb(): Promise<DbInstance> {
  if (dbInstance) {
    return dbInstance;
  }

  // 初期化中なら同じPromiseを返す（複数回fetchを防ぐ）
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    // Initialize SQL.js
    const SQL = await initSqlJs({
      locateFile: (file) => `https://sql.js.org/dist/${file}`,
    });

    const buffer = await getCachedDbBuffer();
    sqliteInstance = new SQL.Database(new Uint8Array(buffer));

    dbInstance = drizzle(sqliteInstance, { schema });

    return dbInstance;
  })();

  return initPromise;
}

export function closeDb(): void {
  if (sqliteInstance) {
    sqliteInstance.close();
    sqliteInstance = null;
    dbInstance = null;
    initPromise = null;
  }
}

export { schema };
