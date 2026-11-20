import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb, getDb } from '../../src/lib/server/db';
import { claims, items } from '../../src/lib/server/db/schema';
import {
	createItem, deleteItem, ensureSeasonList, getFamily, getItemForViewer, getListForViewer, setPriority, updateItem
} from '../../src/lib/server/lists';
import { makeManager, makeUser } from './helpers';

let josh: ReturnType<typeof makeUser>, kate: ReturnType<typeof makeUser>, milo: ReturnType<typeof makeUser>;
beforeEach(() => {
	createTestDb();
	josh = makeUser('josh');
	kate = makeUser('kate');
	milo = makeUser('milo', { isManaged: true });
	makeManager(milo.id, josh.id);
});

describe('editing permissions', () => {
	it('stops Kate editing Josh’s list', () => {
		const i = createItem(josh, josh.id, { title: 'Headphones' }, 2026);
		expect(() => updateItem(kate, i.id, { title: 'Hacked' })).toThrow(expect.objectContaining({ status: 403 }));
		expect(() => deleteItem(kate, i.id)).toThrow(expect.objectContaining({ status: 403 }));
		expect(() => createItem(kate, josh.id, { title: 'x' }, 2026)).toThrow(expect.objectContaining({ status: 403 }));
	});
	it('lets Josh edit Milo’s list as a manager', () => {
		const i = createItem(josh, milo.id, { title: 'Bike' }, 2026);
		updateItem(josh, i.id, { title: 'Kids bike' });
		setPriority(josh, i.id, 'most');
		expect(getListForViewer(josh, milo.id, 2026).items[0]).toMatchObject({ title: 'Kids bike', priority: 'most' });
	});
	it('rejects an empty or overlong title', () => {
		expect(() => createItem(josh, josh.id, { title: '  ' }, 2026)).toThrow(expect.objectContaining({ status: 400 }));
		expect(() => createItem(josh, josh.id, { title: 'x'.repeat(201) }, 2026)).toThrow(expect.objectContaining({ status: 400 }));
	});
});

describe('what the owner sees', () => {
	it('never includes claims on the owner’s own list or item page', () => {
		const i = createItem(josh, josh.id, { title: 'Headphones' }, 2026);
		getDb().insert(claims).values({ itemId: i.id, claimerId: kate.id }).run();
		const list = getListForViewer(josh, josh.id, 2026);
		expect(list.showClaims).toBe(false);
		expect(list.items.every((x) => !('claim' in x))).toBe(true);
		expect('claim' in getItemForViewer(josh, i.id).item).toBe(false);
		expect(getItemForViewer(kate, i.id).item.claim?.claimerName).toBe('Kate');
	});
	it('excludes deleted items and puts most-wanted first', () => {
		createItem(josh, josh.id, { title: 'A' }, 2026);
		const b = createItem(josh, josh.id, { title: 'B', priority: 'most' }, 2026);
		const c = createItem(josh, josh.id, { title: 'C' }, 2026);
		deleteItem(josh, c.id);
		expect(getListForViewer(kate, josh.id, 2026).items.map((x) => x.title)).toEqual(['B', 'A']);
		expect(b.priority).toBe('most');
	});
});

describe('family', () => {
	it('lists everyone but me, with my kids first', () => {
		const fam = getFamily(josh, 2026);
		expect(fam.map((f) => f.displayName)).toEqual(['Milo', 'Kate']);
		expect(fam[0].managedByMe).toBe(true);
		expect(fam.find((f) => f.ownerId === josh.id)).toBeUndefined();
	});
	it('hides deactivated users', () => {
		makeUser('gone', { isActive: false });
		expect(getFamily(josh, 2026).map((f) => f.displayName)).not.toContain('Gone');
	});
});

describe('season rollover', () => {
	it('copies last season’s open gifts without claims, received, or deleted items', () => {
		const keep = createItem(josh, josh.id, { title: 'Keep' }, 2026);
		const got = createItem(josh, josh.id, { title: 'Got it' }, 2026);
		const gone = createItem(josh, josh.id, { title: 'Gone' }, 2026);
		getDb().insert(claims).values({ itemId: keep.id, claimerId: kate.id }).run();
		getDb().update(items).set({ status: 'received' }).where(eq(items.id, got.id)).run();
		deleteItem(josh, gone.id);
		ensureSeasonList(josh.id, 2027);
		const next = getListForViewer(kate, josh.id, 2027).items;
		expect(next.map((x) => x.title)).toEqual(['Keep']);
		expect(next[0].id).not.toBe(keep.id);
		expect('claim' in next[0]).toBe(false);
	});
	it('only copies once', () => {
		createItem(josh, josh.id, { title: 'Keep' }, 2026);
		ensureSeasonList(josh.id, 2027);
		ensureSeasonList(josh.id, 2027);
		expect(getListForViewer(josh, josh.id, 2027).items).toHaveLength(1);
	});
});
