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
		expect(claimItem(june, i.id)).toEqual({ ok: false, reason: 'taken', byName: 'Kate', left: 0 });
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

describe('splitting a gift with a quantity', () => {
	it('lets several people each take some, up to the number wanted', () => {
		const i = createItem(josh, josh.id, { title: 'Wine glasses', quantity: 4 }, 2026);
		expect(claimItem(kate, i.id, 3)).toEqual({ ok: true });
		expect(claimItem(june, i.id, 2)).toEqual({ ok: false, reason: 'taken', byName: 'Kate', left: 1 });
		expect(claimItem(june, i.id, 1)).toEqual({ ok: true });
		expect(claimItem(milo, i.id, 1)).toMatchObject({ ok: false, reason: 'taken', left: 0 });
		const view = getListForViewer(milo, josh.id, 2026).items[0];
		expect(view.quantity).toBe(4);
		expect(view.claims?.map((c) => [c.claimerName, c.quantity])).toEqual([['Kate', 3], ['June', 1]]);
	});
	it('lets a buyer change how many they are getting, within what is left', () => {
		const i = createItem(josh, josh.id, { title: 'Socks', quantity: 3 }, 2026);
		claimItem(kate, i.id, 1);
		claimItem(june, i.id, 1);
		expect(claimItem(kate, i.id, 2)).toEqual({ ok: true });
		expect(claimItem(kate, i.id, 3)).toMatchObject({ ok: false, left: 2 });
		expect(getMyClaims(kate, 2026)[0].mine.quantity).toBe(2);
	});
	it('refuses zero or fractional amounts', () => {
		const i = createItem(josh, josh.id, { title: 'Socks', quantity: 3 }, 2026);
		expect(claimItem(kate, i.id, 0)).toEqual({ ok: false, reason: 'bad-quantity' });
		expect(claimItem(kate, i.id, 1.5)).toEqual({ ok: false, reason: 'bad-quantity' });
	});
	it('unclaiming and buying only touch my own share', () => {
		const i = createItem(josh, josh.id, { title: 'Socks', quantity: 2 }, 2026);
		claimItem(kate, i.id, 1);
		claimItem(june, i.id, 1);
		setPurchased(kate, i.id, true);
		unclaimItem(june, i.id);
		expect(getListForViewer(milo, josh.id, 2026).items[0].claims).toEqual([expect.objectContaining({ claimerName: 'Kate', purchased: true })]);
	});
	it('keeps the owner from seeing any of it', () => {
		const i = createItem(josh, josh.id, { title: 'Socks', quantity: 2 }, 2026);
		claimItem(kate, i.id, 1);
		expect(JSON.stringify(getListForViewer(josh, josh.id, 2026))).not.toContain('Kate');
	});
	it('rejects an owner quantity outside 1 to 99', () => {
		expect(() => createItem(josh, josh.id, { title: 'Socks', quantity: 0 }, 2026)).toThrow(expect.objectContaining({ status: 400 }));
		expect(() => createItem(josh, josh.id, { title: 'Socks', quantity: 100 }, 2026)).toThrow(expect.objectContaining({ status: 400 }));
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
		expect(getListForViewer(kate, josh.id, 2026).items[0].claims?.[0]?.purchased).toBe(true);
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
		expect(getItemForViewer(kate, i.id).item).toMatchObject({ deleted: true, claims: [{ isMine: true }] });
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
		expect(getItemForViewer(kate, i.id).item.claims?.[0]?.changedSinceClaim).toBe(true);
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
