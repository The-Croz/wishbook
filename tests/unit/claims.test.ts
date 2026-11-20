import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../../src/lib/server/db';
import { claimItem, getMyClaims, setPurchased, unclaimItem } from '../../src/lib/server/claims';
import { createItem, deleteItem, getListForViewer } from '../../src/lib/server/lists';
import { makeManager, makeUser } from './helpers';

let josh: ReturnType<typeof makeUser>, kate: ReturnType<typeof makeUser>, june: ReturnType<typeof makeUser>, milo: ReturnType<typeof makeUser>;
beforeEach(() => {
	createTestDb();
	josh = makeUser('josh'); kate = makeUser('kate'); june = makeUser('june'); milo = makeUser('milo', { isManaged: true });
	makeManager(milo.id, josh.id);
});

describe('claimItem', () => {
	it('refuses a claim on your own list', () => {
		const i = createItem(josh, josh.id, { title: 'Headphones' }, 2026);
		expect(claimItem(josh, i.id)).toEqual({ ok: false, reason: 'own-list' });
	});
	it('lets exactly one person claim, and tells the second who has it', () => {
		const i = createItem(josh, josh.id, { title: 'Headphones' }, 2026);
		expect(claimItem(kate, i.id)).toEqual({ ok: true });
		expect(claimItem(june, i.id)).toEqual({ ok: false, reason: 'taken', byName: 'Kate' });
	});
	it('lets a managing parent claim on the kid list', () => {
		const i = createItem(josh, milo.id, { title: 'Bike' }, 2026);
		expect(claimItem(josh, i.id)).toEqual({ ok: true });
	});
	it('refuses a claim on a removed gift', () => {
		const i = createItem(josh, josh.id, { title: 'Headphones' }, 2026);
		deleteItem(josh, i.id);
		expect(claimItem(kate, i.id)).toEqual({ ok: false, reason: 'removed' });
	});
});

describe('unclaim and purchased', () => {
	it('only the claimer can unclaim', () => {
		const i = createItem(josh, josh.id, { title: 'Headphones' }, 2026);
		claimItem(kate, i.id);
		expect(() => unclaimItem(june, i.id)).toThrow(expect.objectContaining({ status: 403 }));
		unclaimItem(kate, i.id);
		expect(claimItem(june, i.id)).toEqual({ ok: true });
	});
	it('only the claimer can mark purchased', () => {
		const i = createItem(josh, josh.id, { title: 'Headphones' }, 2026);
		claimItem(kate, i.id);
		expect(() => setPurchased(june, i.id, true)).toThrow(expect.objectContaining({ status: 403 }));
		setPurchased(kate, i.id, true);
		expect(getListForViewer(kate, josh.id, 2026).items[0].claim?.purchased).toBe(true);
	});
});

describe('getMyClaims', () => {
	it('keeps a removed gift with a removed flag', () => {
		const i = createItem(josh, josh.id, { title: 'Headphones' }, 2026);
		claimItem(kate, i.id);
		deleteItem(josh, i.id);
		const mine = getMyClaims(kate, 2026);
		expect(mine).toHaveLength(1);
		expect(mine[0]).toMatchObject({ ownerName: 'Josh', removed: true, title: 'Headphones' });
	});
	it('never includes gifts from my own list', () => {
		const i = createItem(josh, milo.id, { title: 'Bike' }, 2026);
		claimItem(josh, i.id);
		const own = createItem(kate, kate.id, { title: 'Mug' }, 2026);
		claimItem(josh, own.id);
		expect(getMyClaims(kate, 2026)).toHaveLength(0);
		expect(getMyClaims(josh, 2026).map((c) => c.title).sort()).toEqual(['Bike', 'Mug']);
	});
});

import { getItemForViewer, updateItem } from '../../src/lib/server/lists';
describe('after the owner changes a claimed gift', () => {
	it('the claimer can still open a removed gift and unclaim it', () => {
		const i = createItem(josh, josh.id, { title: 'Headphones' }, 2026);
		claimItem(kate, i.id);
		deleteItem(josh, i.id);
		expect(getItemForViewer(kate, i.id).item).toMatchObject({ deleted: true, claim: { isMine: true } });
		expect(() => getItemForViewer(june, i.id)).toThrow(expect.objectContaining({ status: 404 }));
		unclaimItem(kate, i.id);
		expect(getMyClaims(kate, 2026)).toHaveLength(0);
	});
	it('the claimer sees that the gift changed, the owner learns nothing', async () => {
		const i = createItem(josh, josh.id, { title: 'Sony headphones' }, 2026);
		claimItem(kate, i.id);
		await new Promise((r) => setTimeout(r, 5));
		updateItem(josh, i.id, { title: 'Bose headphones' });
		expect(getMyClaims(kate, 2026)[0]).toMatchObject({ title: 'Bose headphones', changed: true });
		expect(getItemForViewer(kate, i.id).item.claim?.changedSinceClaim).toBe(true);
		expect(JSON.stringify(getItemForViewer(josh, i.id))).not.toContain('changed');
	});
	it('a priority change alone does not count as a change', async () => {
		const i = createItem(josh, josh.id, { title: 'Mug' }, 2026);
		claimItem(kate, i.id);
		await new Promise((r) => setTimeout(r, 5));
		updateItem(josh, i.id, { priority: 'most' });
		expect(getMyClaims(kate, 2026)[0].changed).toBe(false);
	});
});
