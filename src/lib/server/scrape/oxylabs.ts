import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { appSettings } from '../db/schema';
import type { ScrapeResult } from './index';

/**
 * Amazon product lookups through Oxylabs' Web API, used only when Amazon blocks our own
 * request. Off unless OXYLABS_API_KEY is set. A monthly cap (OXYLABS_MONTHLY_LIMIT,
 * default 300) keeps a bad night from spending the credit.
 */
const ENDPOINT = 'https://webapi.oxylabs.io/v1/scrape/amazon/product';

export const oxylabsEnabled = () => !!process.env.OXYLABS_API_KEY;

const monthKey = (d = new Date()) => `oxylabs_calls_${d.getUTCFullYear()}_${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

export function oxylabsCallsThisMonth(): number {
	const row = getDb().select().from(appSettings).where(eq(appSettings.key, monthKey())).get();
	return Number(row?.value ?? 0);
}

function countCall() {
	const key = monthKey();
	const n = String(oxylabsCallsThisMonth() + 1);
	getDb().insert(appSettings).values({ key, value: n }).onConflictDoUpdate({ target: appSettings.key, set: { value: n } }).run();
}

const limit = () => Number(process.env.OXYLABS_MONTHLY_LIMIT) || 300;

const num = (v: unknown): number | undefined => {
	if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
	if (typeof v === 'string') {
		const n = Number(v.replace(/[^\d.]/g, ''));
		if (Number.isFinite(n) && n > 0) return n;
	}
	return undefined;
};

/** Finds the parsed product, whichever wrapper the response uses. */
function productOf(body: any): any {
	const candidates = [body?.results?.[0]?.content, body?.results?.[0], body?.content, body];
	return candidates.find((c) => c && typeof c === 'object' && typeof c.title === 'string' && c.title.trim());
}

function firstImage(p: any): string | undefined {
	const raw = p.images ?? p.image ?? p.main_image ?? p.image_url;
	const list = Array.isArray(raw) ? raw : [raw];
	for (const i of list) {
		const u = typeof i === 'string' ? i : i?.url ?? i?.link;
		if (typeof u === 'string' && u.startsWith('https://')) return u;
	}
	return undefined;
}

/** Pure: turns an Oxylabs response into gift details, or null if it has no product. */
export function parseOxylabs(url: string, body: unknown): ScrapeResult | null {
	const p = productOf(body);
	if (!p) return null;
	const result: ScrapeResult = { status: 'ok', url, store: 'Amazon', title: p.title.replace(/\s+/g, ' ').trim() };
	const price = num(p.price ?? p.price_buybox ?? p.price_upper);
	if (price) {
		result.priceCents = Math.round(price * 100);
		result.currency = typeof p.currency === 'string' && /^[A-Z]{3}$/.test(p.currency) ? p.currency : 'USD';
		const list = num(p.price_strikethrough ?? p.price_initial ?? p.list_price);
		if (list && list > price) result.listPriceCents = Math.round(list * 100);
	}
	const img = firstImage(p);
	if (img) result.imageUrl = img;
	return result;
}

/** Looks up one Amazon product. Null when off, over the cap, or anything goes wrong. */
export async function lookupAmazon(url: string, fetchImpl: typeof fetch = fetch): Promise<ScrapeResult | null> {
	const key = process.env.OXYLABS_API_KEY;
	if (!key) return null;
	const u = new URL(url);
	const asin = u.pathname.match(/\/dp\/([A-Z0-9]{10})/i)?.[1];
	if (!asin) return null;
	if (oxylabsCallsThisMonth() >= limit()) {
		console.warn('[wishbook] Oxylabs monthly limit reached; skipping lookup');
		return null;
	}
	const domain = u.hostname.replace(/^www\./, '').replace(/^amazon\./, '') || 'com';
	try {
		countCall();
		const res = await fetchImpl(ENDPOINT, {
			method: 'POST',
			headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ query: asin.toUpperCase(), domain, output: ['json'] }),
			signal: AbortSignal.timeout(60_000)
		});
		if (!res.ok) {
			console.warn(`[wishbook] Oxylabs lookup failed: HTTP ${res.status}`);
			return null;
		}
		const parsed = parseOxylabs(url, await res.json());
		if (!parsed) console.warn('[wishbook] Oxylabs answered without a product');
		return parsed;
	} catch (e) {
		console.warn('[wishbook] Oxylabs lookup error', e);
		return null;
	}
}
