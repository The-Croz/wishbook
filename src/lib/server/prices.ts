import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import cron from 'node-cron';
import { getDb } from './db';
import { items, lists, priceHistory } from './db/schema';
import { scrape, type ScrapeResult } from './scrape';
import { isAmazon, isPlaceholderTitle } from './scrape/extractUrl';
import { currentSeason } from '$lib/season';
import { notifyPriceDrop } from './notify';
import { error } from '@sveltejs/kit';
import { getItemForViewer } from './lists';
import type { User } from './db/schema';

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
	if (r.title && isPlaceholderTitle(item.title)) patch.title = r.title;
	if (!item.imageUrl && r.imageUrl) patch.imageUrl = r.imageUrl;
	if (!item.store && r.store) patch.store = r.store;
	db.update(items).set(patch).where(eq(items.id, itemId)).run();
	if (r.priceCents != null && item.priceCents != null && r.priceCents < item.priceCents) notifyPriceDrop(itemId, item.priceCents, r.priceCents, r.currency ?? item.currency);
	return 'ok';
}

/**
 * "Refresh from link": the owner (or a manager or admin) re-reads the gift's link and
 * whatever the page gives replaces the saved name, picture, store and price.
 * A blocked or failed read changes nothing.
 */
export async function repullItem(viewer: User, itemId: number, fetchImpl: typeof fetch = fetch): Promise<ScrapeResult['status']> {
	const { item: view, canEdit } = getItemForViewer(viewer, itemId);
	if (!canEdit && !viewer.isAdmin) error(403, 'Only the list owner can refresh this gift');
	if (view.deleted) error(404, 'Gift not found');
	const db = getDb();
	const item = db.select().from(items).where(eq(items.id, itemId)).get();
	if (!item?.url) return 'failed';
	const r = await scrape(item.url, fetchImpl);
	if (r.status !== 'ok' || !r.title || isPlaceholderTitle(r.title)) {
		db.update(items).set({ scrapeStatus: r.status === 'ok' ? 'failed' : r.status }).where(eq(items.id, itemId)).run();
		return r.status === 'ok' ? 'failed' : r.status;
	}
	const now = new Date();
	const patch: Partial<typeof items.$inferInsert> = { scrapeStatus: 'ok', title: r.title.slice(0, 200), updatedAt: now };
	if (r.imageUrl) patch.imageUrl = r.imageUrl;
	if (r.store) patch.store = r.store;
	if (r.priceCents != null) {
		patch.priceCents = r.priceCents;
		patch.listPriceCents = r.listPriceCents ?? null;
		patch.currency = r.currency ?? item.currency;
		patch.priceCheckedAt = now;
		if (r.priceCents !== item.priceCents) db.insert(priceHistory).values({ itemId, priceCents: r.priceCents, checkedAt: now }).run();
	}
	db.update(items).set(patch).where(eq(items.id, itemId)).run();
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

/**
 * Amazon lets an occasional request through, so gifts saved while blocked get a few
 * more chances during the day instead of waiting for the nightly run. Only gifts still
 * missing a real name, price or picture are retried, a handful at a time, spaced out.
 */
export async function retryIncomplete(
	fetchImpl: typeof fetch = fetch,
	opts: { season?: number; limit?: number; delayMs?: () => number } = {}
): Promise<{ checked: number; fixed: number }> {
	const season = opts.season ?? currentSeason(new Date());
	const limit = opts.limit ?? 5;
	const delay = opts.delayMs ?? (() => 4000 + Math.random() * 5000);
	const db = getDb();
	const rows = db.select({ id: items.id, title: items.title, price: items.priceCents, image: items.imageUrl }).from(items)
		.innerJoin(lists, eq(lists.id, items.listId))
		.where(and(eq(lists.season, season), eq(items.status, 'active'), isNull(items.deletedAt), isNotNull(items.url),
			inArray(items.scrapeStatus, ['blocked', 'failed'])))
		.all()
		.filter((r) => isPlaceholderTitle(r.title) || r.price == null || !r.image)
		.slice(0, limit);
	let fixed = 0;
	for (const [n, row] of rows.entries()) {
		if (n > 0) await sleep(delay());
		if ((await refreshItem(row.id, fetchImpl)) === 'ok') fixed++;
	}
	return { checked: rows.length, fixed };
}

/** One quiet retry a couple of minutes after a gift is saved without its details. */
export function retrySoon(itemId: number, afterMs = 2 * 60_000) {
	if (process.env.DISABLE_PRICE_REFRESH === '1') return;
	setTimeout(() => {
		refreshItem(itemId).catch((e) => console.error('[wishbook] retry failed', e));
	}, afterMs).unref?.();
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
	// Catch-up for gifts still missing details: every 2 hours, 9am–9pm.
	cron.schedule('0 9-21/2 * * *', async () => {
		if (running) return;
		running = true;
		try {
			const r = await retryIncomplete();
			if (r.checked) console.log(`[wishbook] catch-up: ${JSON.stringify(r)}`);
		} catch (e) {
			console.error('[wishbook] catch-up failed', e);
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
