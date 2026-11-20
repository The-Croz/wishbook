import type { ItemView } from './types';

export type SortMode = 'list' | 'newest' | 'oldest' | 'priceLow' | 'priceHigh';

export const SORT_LABELS: Record<SortMode, string> = {
	list: 'Their order',
	newest: 'Newest first',
	oldest: 'Oldest first',
	priceLow: 'Price: low to high',
	priceHigh: 'Price: high to low'
};

/** The list's own order when the owner arranged it by hand, otherwise newest first. */
export const defaultSort = (customOrder: boolean): SortMode => (customOrder ? 'list' : 'newest');

const byMode: Record<SortMode, (a: ItemView, b: ItemView) => number> = {
	list: (a, b) => a.sortOrder - b.sortOrder || b.createdAt - a.createdAt,
	newest: (a, b) => b.createdAt - a.createdAt || b.id - a.id,
	oldest: (a, b) => a.createdAt - b.createdAt || a.id - b.id,
	// Gifts without a price go last either way.
	priceLow: (a, b) => (a.priceCents ?? Infinity) - (b.priceCents ?? Infinity),
	priceHigh: (a, b) => (b.priceCents ?? -Infinity) - (a.priceCents ?? -Infinity)
};

/** Most-wanted gifts always come first; the chosen order applies within each group. */
export function sortGifts(items: ItemView[], mode: SortMode): ItemView[] {
	return [...items].sort((a, b) => Number(b.priority === 'most') - Number(a.priority === 'most') || byMode[mode](a, b) || a.id - b.id);
}
