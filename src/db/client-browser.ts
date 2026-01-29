import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase } from 'sql.js';
import { drizzle } from 'drizzle-orm/sql-js';
import * as schema from './schema';

type DbInstance = ReturnType<typeof drizzle<typeof schema>>;

let dbInstance: DbInstance | null = null;
let sqliteInstance: SqlJsDatabase | null = null;
let initPromise: Promise<DbInstance> | null = null;

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

    // Fetch the database file (use Vite's base URL)
    const response = await fetch(`${import.meta.env.BASE_URL}unicode.db`);
    if (!response.ok) {
      throw new Error(`Failed to fetch database: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
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
