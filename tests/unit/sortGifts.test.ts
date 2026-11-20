import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../../src/lib/server/db';
import { createItem, getListForViewer, reorderList, resetListOrder, setPriority } from '../../src/lib/server/lists';
import { defaultSort, sortGifts } from '../../src/lib/sortGifts';
import type { ItemView } from '../../src/lib/types';
import { makeManager, makeUser } from './helpers';

const v = (id: number, extra: Partial<ItemView> = {}) =>
	({ id, title: `g${id}`, priority: 'want', priceCents: null, createdAt: id * 1000, sortOrder: 0, ...extra }) as ItemView;
const ids = (xs: ItemView[]) => xs.map((x) => x.id);

describe('sortGifts', () => {
	const items = [v(1, { priceCents: 500 }), v(2, { priceCents: 100 }), v(3, { priority: 'most', priceCents: 900 }), v(4)];
	it('defaults to newest first with most-wanted pinned on top', () => {
		expect(defaultSort(false)).toBe('newest');
		expect(ids(sortGifts(items, 'newest'))).toEqual([3, 4, 2, 1]);
	});
	it('sorts oldest first', () => expect(ids(sortGifts(items, 'oldest'))).toEqual([3, 1, 2, 4]));
	it('sorts by price with unpriced gifts last', () => {
		expect(ids(sortGifts(items, 'priceLow'))).toEqual([3, 2, 1, 4]);
		expect(ids(sortGifts(items, 'priceHigh'))).toEqual([3, 1, 2, 4]);
	});
	it('uses the hand-made order', () => {
		const custom = [v(1, { sortOrder: 2 }), v(2, { sortOrder: 0 }), v(3, { sortOrder: 1 })];
		expect(defaultSort(true)).toBe('list');
		expect(ids(sortGifts(custom, 'list'))).toEqual([2, 3, 1]);
	});
});

describe('reorderList', () => {
	let josh: ReturnType<typeof makeUser>, kate: ReturnType<typeof makeUser>, milo: ReturnType<typeof makeUser>;
	beforeEach(() => {
		createTestDb();
		josh = makeUser('josh');
		kate = makeUser('kate');
		milo = makeUser('milo', { isManaged: true });
		makeManager(milo.id, josh.id);
	});
	const add = (owner: typeof josh, title: string) => createItem(josh, owner.id, { title }, 2026).id;

	it('saves the owner’s order and makes it the default', () => {
		const [a, b, c] = ['A', 'B', 'C'].map((t) => add(josh, t));
		reorderList(josh, josh.id, [c, a, b], 2026);
		const list = getListForViewer(kate, josh.id, 2026);
		expect(list.customOrder).toBe(true);
		expect(ids(sortGifts(list.items, defaultSort(list.customOrder)))).toEqual([c, a, b]);
	});
	it('puts a new gift at the top of an arranged list', () => {
		const [a, b] = ['A', 'B'].map((t) => add(josh, t));
		reorderList(josh, josh.id, [b, a], 2026);
		const n = add(josh, 'New');
		const list = getListForViewer(josh, josh.id, 2026);
		expect(ids(sortGifts(list.items, 'list'))).toEqual([n, b, a]);
	});
	it('lets a manager arrange a managed list but not anyone else', () => {
		const [a, b] = ['A', 'B'].map((t) => add(milo, t));
		reorderList(josh, milo.id, [b, a], 2026);
		expect(() => reorderList(kate, milo.id, [a, b], 2026)).toThrow(expect.objectContaining({ status: 403 }));
		expect(() => reorderList(kate, josh.id, [], 2026)).toThrow(expect.objectContaining({ status: 403 }));
	});
	it('ignores gifts from other lists', () => {
		const a = add(josh, 'A');
		const other = add(milo, 'Milo gift');
		reorderList(josh, josh.id, [other, a], 2026);
		expect(getListForViewer(josh, milo.id, 2026).items[0].sortOrder).not.toBe(0);
	});
	it('goes back to newest first on reset, keeping most wanted on top', () => {
		const [a, b] = ['A', 'B'].map((t) => add(josh, t));
		setPriority(josh, a, 'most');
		reorderList(josh, josh.id, [a, b], 2026);
		resetListOrder(josh, josh.id, 2026);
		const list = getListForViewer(josh, josh.id, 2026);
		expect(list.customOrder).toBe(false);
		expect(ids(sortGifts(list.items, defaultSort(false)))[0]).toBe(a);
	});
});
