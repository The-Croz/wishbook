import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import * as schema from './schema';

export type DB = BetterSQLite3Database<typeof schema>;

function migrationsFolder(): string {
	const candidates = [resolve(process.cwd(), 'drizzle'), resolve(dirname(fileURLToPath(import.meta.url)), '../../../../drizzle')];
	return candidates.find((p) => existsSync(p)) ?? candidates[0];
}

function open(path: string): DB {
	if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
	const sqlite = new Database(path);
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = ON');
	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: migrationsFolder() });
	return db;
}

let current: DB | null = null;

/** The app database, opened (and migrated) on first use. */
export function getDb(): DB {
	current ??= open(process.env.DATABASE_PATH ?? '/data/wishbook.db');
	return current;
}

/** Fresh migrated in-memory database; also becomes the app database for the test. */
export function createTestDb(): DB {
	current = open(':memory:');
	return current;
}
