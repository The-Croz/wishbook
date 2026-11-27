import { and, desc, eq, gte, inArray, or } from 'drizzle-orm';
import { getDb } from './db';
import { items, priceHistory, type Item } from './db/schema';
import { LOOKBACK_DAYS, priceSignal, type PriceSample } from '$lib/priceSignal';
import type { ItemView } from '$lib/types';

const DAY = 86_400_000;

/**
 * Saves one price reading per gift per day (a later reading the same day replaces it).
 * The first time a gift is read, the price it was saved with is kept too, so its
 * history starts the day it went on the list.
 */
export function recordPrice(item: Pick<Item, 'id' | 'priceCents' | 'priceCheckedAt' | 'createdAt'>, priceCents: number, at = new Date()) {
	const db = getDb();
	const last = db.select().from(priceHistory).where(eq(priceHistory.itemId, item.id)).orderBy(desc(priceHistory.checkedAt)).limit(1).get();
	if (!last && item.priceCents != null) {
		const since = item.priceCheckedAt ?? item.createdAt;
		if (Math.floor(since.getTime() / DAY) < Math.floor(at.getTime() / DAY)) {
			db.insert(priceHistory).values({ itemId: item.id, priceCents: item.priceCents, checkedAt: since }).run();
		}
	}
	if (last && Math.floor(last.checkedAt.getTime() / DAY) === Math.floor(at.getTime() / DAY)) {
		db.update(priceHistory).set({ priceCents, checkedAt: at }).where(eq(priceHistory.id, last.id)).run();
	} else {
		db.insert(priceHistory).values({ itemId: item.id, priceCents, checkedAt: at }).run();
	}
}

/** A link to a specific product page. A bare homepage could be anything, so it isn't shared between gifts. */
function poolKey(v: Pick<ItemView, 'id' | 'url'>): string {
	try {
		if (v.url && new URL(v.url).pathname.length > 1) return `url:${v.url}`;
	} catch { /* not a URL */ }
	return `item:${v.id}`;
}

/**
 * Adds the "real deal" / "usual price" signal to gifts. History is pooled by product
 * link, so the same product on someone else's list, or on last year's list, counts too.
 */
export function withPriceSignals<T extends ItemView>(views: T[], now = new Date()): T[] {
	const priced = views.filter((v) => v.priceCents != null);
	if (!priced.length) return views;
	const urls = [...new Set(priced.map(poolKey).filter((k) => k.startsWith('url:')).map((k) => k.slice(4)))];
	const ids = priced.map((v) => v.id);
	const rows = getDb().select({ id: items.id, url: items.url, priceCents: priceHistory.priceCents, checkedAt: priceHistory.checkedAt })
		.from(priceHistory).innerJoin(items, eq(items.id, priceHistory.itemId))
		.where(and(urls.length ? or(inArray(items.url, urls), inArray(items.id, ids)) : inArray(items.id, ids),
			gte(priceHistory.checkedAt, new Date(now.getTime() - LOOKBACK_DAYS * DAY))))
		.all();
	const pools = new Map<string, PriceSample[]>();
	for (const r of rows) {
		for (const key of new Set([poolKey(r), `item:${r.id}`])) {
			const list = pools.get(key) ?? [];
			list.push(r);
			pools.set(key, list);
		}
	}
	for (const v of priced) {
		const s = priceSignal(pools.get(poolKey(v)) ?? [], v.priceCents, v.listPriceCents, now);
		if (s) v.priceSignal = s;
	}
	return views;
}
