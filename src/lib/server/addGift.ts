import { error } from '@sveltejs/kit';
import type { Item, User } from './db/schema';
import { createItem, updateItem, type ItemInput, type Priority } from './lists';
import { parsePrice } from '$lib/money';
import { storeFromHost } from './scrape/generic';
import { isAmazon, placeholderTitle } from './scrape/extractUrl';

const STATUSES = ['ok', 'blocked', 'failed', 'manual'] as const;

function webUrl(raw: string): string | null {
	const v = raw.trim();
	if (!v) return null;
	try {
		const u = new URL(v);
		if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error();
		return u.toString();
	} catch {
		error(400, 'That link doesn’t look like a web address');
	}
}

function httpsOnly(raw: string): string | null {
	const v = raw.trim();
	return /^https?:\/\//i.test(v) ? v : null;
}

/** Turns the add/edit form into an item and saves it. */
export function saveGift(viewer: User, target: { ownerId: number; editId?: number }, form: FormData): Item {
	const s = (k: string) => String(form.get(k) ?? '');
	const url = webUrl(s('url'));
	let title = s('title').trim();
	if (!title && url) title = placeholderTitle(url);
	const priceText = s('price').trim();
	const price = priceText ? parsePrice(priceText) : null;
	const listCents = Number(s('listPriceCents')) || null;
	const status = s('scrapeStatus') as Item['scrapeStatus'];
	const priority = (['nice', 'want', 'most'].includes(s('priority')) ? s('priority') : 'want') as Priority;
	const input: ItemInput = {
		title,
		url,
		imageUrl: httpsOnly(s('imageUrl')),
		store: s('store').trim() || (url ? (isAmazon(new URL(url).hostname) ? 'Amazon' : storeFromHost(new URL(url).hostname)) : null),
		priceCents: price?.cents ?? null,
		listPriceCents: price && listCents && listCents > price.cents ? listCents : null,
		currency: price?.currency ?? (s('currency') || 'USD'),
		notes: s('notes'),
		priority,
		scrapeStatus: STATUSES.includes(status) ? status : 'manual'
	};
	return target.editId ? updateItem(viewer, target.editId, input) : createItem(viewer, target.ownerId, input);
}
