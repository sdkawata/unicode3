import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase } from 'sql.js';
import { drizzle } from 'drizzle-orm/sql-js';
import * as schema from './schema';

type DbInstance = ReturnType<typeof drizzle<typeof schema>>;

let dbInstance: DbInstance | null = null;
let sqliteInstance: SqlJsDatabase | null = null;

export async function getDb(): Promise<DbInstance> {
  if (dbInstance) {
    return dbInstance;
  }

  // Initialize SQL.js
  const SQL = await initSqlJs({
    locateFile: (file) => `https://sql.js.org/dist/${file}`,
  });

  // Fetch the database file
  const response = await fetch('/unicode.db');
  if (!response.ok) {
    throw new Error(`Failed to fetch database: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  sqliteInstance = new SQL.Database(new Uint8Array(buffer));

  dbInstance = drizzle(sqliteInstance, { schema });

  return dbInstance;
}

export function closeDb(): void {
  if (sqliteInstance) {
    sqliteInstance.close();
    sqliteInstance = null;
    dbInstance = null;
  }
}

export { schema };
