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

/** Opens (creating if needed) and migrates a database file. */
export function openDatabase(path: string): DB {
	let sqlite: Database.Database;
	try {
		if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
		sqlite = new Database(path);
	} catch (e) {
		throw new Error(
			`Wishbook can’t write to ${dirname(path)} (${(e as Error).message}). ` +
				`Give the container’s user ownership of your data folder, e.g. chown -R 1000:1000 ./data, or set PUID/PGID.`
		);
	}
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = ON');
	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: migrationsFolder() });
	return db;
}

let current: DB | null = null;

/** The app database, opened (and migrated) on first use. */
export function getDb(): DB {
	current ??= openDatabase(process.env.DATABASE_PATH ?? '/data/wishbook.db');
	return current;
}

/** Fresh migrated in-memory database; also becomes the app database for the test. */
export function createTestDb(): DB {
	current = openDatabase(':memory:');
	return current;
}
