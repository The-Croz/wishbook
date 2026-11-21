import { describe, expect, it } from 'vitest';
import { createTestDb } from '../../src/lib/server/db';
import { users, lists, items, claims } from '../../src/lib/server/db/schema';

describe('schema', () => {
	it('allows one claim row per person per item, and several people per item', () => {
		const db = createTestDb();
		const [a] = db.insert(users).values({ username: 'a', displayName: 'A' }).returning().all();
		const [b] = db.insert(users).values({ username: 'b', displayName: 'B' }).returning().all();
		const [l] = db.insert(lists).values({ ownerId: a.id, season: 2026 }).returning().all();
		const [i] = db.insert(items).values({ listId: l.id, title: 'Socks', createdBy: a.id }).returning().all();
		db.insert(claims).values({ itemId: i.id, claimerId: b.id }).run();
		expect(() => db.insert(claims).values({ itemId: i.id, claimerId: b.id }).run()).toThrow();
		expect(() => db.insert(claims).values({ itemId: i.id, claimerId: a.id }).run()).not.toThrow();
		expect(i.quantity).toBe(1);
	});
});
