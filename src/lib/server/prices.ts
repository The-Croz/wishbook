import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import cron from 'node-cron';
import { getDb } from './db';
import { items, lists, priceHistory } from './db/schema';
import { scrape, type ScrapeResult } from './scrape';
import { isAmazon } from './scrape/extractUrl';
import { currentSeason } from '$lib/season';
import { notifyPriceDrop } from './notify';

/** Re-reads one gift's link. Only updates price/image on a clean read; a blocked or failed read changes nothing but the status. */
export async function refreshItem(itemId: number, fetchImpl: typeof fetch = fetch): Promise<ScrapeResult['status']> {
	const db = getDb();
	const item = db.select().from(items).where(eq(items.id, itemId)).get();
	if (!item?.url) return 'failed';
	const r = await scrape(item.url, fetchImpl);
	if (r.status !== 'ok') {
		db.update(items).set({ scrapeStatus: r.status }).where(eq(items.id, itemId)).run();
		return r.status;
	}
	const now = new Date();
	const patch: Partial<typeof items.$inferInsert> = { scrapeStatus: 'ok' };
	if (r.priceCents != null) {
		patch.priceCents = r.priceCents;
		patch.listPriceCents = r.listPriceCents ?? null;
		patch.currency = r.currency ?? item.currency;
		patch.priceCheckedAt = now;
		if (r.priceCents !== item.priceCents) db.insert(priceHistory).values({ itemId, priceCents: r.priceCents, checkedAt: now }).run();
	}
	if (!item.imageUrl && r.imageUrl) patch.imageUrl = r.imageUrl;
	if (!item.store && r.store) patch.store = r.store;
	db.update(items).set(patch).where(eq(items.id, itemId)).run();
	if (r.priceCents != null && item.priceCents != null && r.priceCents < item.priceCents) notifyPriceDrop(itemId, item.priceCents, r.priceCents, r.currency ?? item.currency);
	return 'ok';
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Re-checks every live gift with a link in the season, gently. */
export async function refreshPrices(
	fetchImpl: typeof fetch = fetch,
	opts: { season?: number; delayMs?: (url: string) => number } = {}
): Promise<{ checked: number; changed: number; blocked: number; failed: number }> {
	const season = opts.season ?? currentSeason(new Date());
	const delay = opts.delayMs ?? ((url: string) => (isAmazon(new URL(url).hostname) ? 4000 + Math.random() * 5000 : 1000));
	const db = getDb();
	const rows = db.select({ id: items.id, url: items.url, price: items.priceCents }).from(items)
		.innerJoin(lists, eq(lists.id, items.listId))
		.where(and(eq(lists.season, season), eq(items.status, 'active'), isNull(items.deletedAt), isNotNull(items.url))).all();
	const out = { checked: 0, changed: 0, blocked: 0, failed: 0 };
	for (const [n, row] of rows.entries()) {
		if (n > 0) await sleep(delay(row.url!));
		const status = await refreshItem(row.id, fetchImpl);
		out.checked++;
		if (status === 'blocked') out.blocked++;
		else if (status === 'failed') out.failed++;
		else if (db.select({ p: items.priceCents }).from(items).where(eq(items.id, row.id)).get()?.p !== row.price) out.changed++;
	}
	return out;
}

let started = false;
let running = false;

/** Nightly at 3am server time. */
export function startPriceScheduler() {
	if (started || process.env.DISABLE_PRICE_REFRESH === '1') return;
	started = true;
	cron.schedule('0 3 * * *', async () => {
		if (running) return;
		running = true;
		try {
			const r = await refreshPrices();
			console.log(`[wishbook] price refresh: ${JSON.stringify(r)}`);
		} catch (e) {
			console.error('[wishbook] price refresh failed', e);
		} finally {
			running = false;
		}
	});
}

export function isRefreshRunning() {
	return running;
}

/** Admin "refresh now": runs in the background. */
export function refreshNow(): boolean {
	if (running) return false;
	running = true;
	refreshPrices()
		.then((r) => console.log(`[wishbook] manual price refresh: ${JSON.stringify(r)}`))
		.catch((e) => console.error('[wishbook] manual price refresh failed', e))
		.finally(() => (running = false));
	return true;
}
