import { load } from 'cheerio';
import { canonicalize, extractUrl, isAmazon, titleFromShareText } from './extractUrl';
import { parseAmazon } from './amazon';
import { parseGeneric } from './generic';
import { fetchPageHtml, lookupAmazon, oxylabsEnabled } from './oxylabs';

/** The canonical /dp/ASIN link when the pasted text holds a full Amazon product link (short a.co links need a fetch first). */
function amazonDirect(rawText: string): string | null {
	const found = extractUrl(rawText);
	if (!found) return null;
	try {
		const c = canonicalize(found);
		return isAmazonUrl(c) && /\/dp\/[A-Z0-9]{10}$/i.test(c) ? c : null;
	} catch {
		return null;
	}
}

const isAmazonUrl = (u: string) => {
	try { return isAmazon(new URL(u).hostname); } catch { return false; }
};

export type ScrapeResult = {
	status: 'ok' | 'blocked' | 'failed';
	url: string;
	title?: string;
	imageUrl?: string;
	store?: string;
	priceCents?: number;
	listPriceCents?: number;
	currency?: string;
};

const HEADERS = {
	'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
	Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
	'Accept-Language': 'en-US,en;q=0.9'
};

/** Pure: turns a page's HTML into gift details. */
export function parseHtml(url: string, html: string): ScrapeResult {
	const $ = load(html);
	return isAmazon(new URL(url).hostname) ? parseAmazon(url, $, html) : parseGeneric(url, $);
}

/** Titles that bot-protection pages show instead of the product. */
const CHALLENGE_TITLE = /just a moment|security checkpoint|site unavailable|access denied|attention required|robot|pardon our interruption|request blocked|verify you are human|are you a human/i;
export const isChallengeTitle = (t: string | undefined): boolean => !!t && CHALLENGE_TITLE.test(t);

/** A store that bot-blocks our request: read the page through Oxylabs instead (plain first, then with JavaScript). */
async function pageViaOxylabs(url: string, fetchImpl: typeof fetch): Promise<ScrapeResult | null> {
	let titled: ScrapeResult | null = null;
	for (const runJs of [false, true]) {
		const html = await fetchPageHtml(url, fetchImpl, runJs);
		if (!html) continue;
		let r: ScrapeResult;
		try { r = parseHtml(url, html); } catch { continue; }
		if (r.status !== 'ok' || !r.title || isChallengeTitle(r.title)) continue;
		if (r.priceCents != null) return r;
		titled ??= r;
	}
	return titled;
}

/** Fetches a pasted link and reads gift details from it. Never throws. */
export async function scrape(rawText: string, fetchImpl: typeof fetch = fetch): Promise<ScrapeResult> {
	// Amazon blocks nearly every direct read, so with Oxylabs set up go straight to it.
	const direct = amazonDirect(rawText);
	if (direct && oxylabsEnabled()) {
		const hit = await lookupAmazon(direct, fetchImpl);
		if (hit) return hit;
	}
	let r = direct && oxylabsEnabled() ? { status: 'blocked' as const, url: direct } : await scrapePage(rawText, fetchImpl);
	if (r.status !== 'ok' && !direct && isAmazonUrl(r.url)) r = (await lookupAmazon(r.url, fetchImpl)) ?? r;
	if (r.status === 'ok' || r.title) return r;
	const shared = titleFromShareText(rawText);
	return shared ? { ...r, title: shared } : r;
}

async function scrapePage(rawText: string, fetchImpl: typeof fetch): Promise<ScrapeResult> {
	const found = extractUrl(rawText);
	if (!found) return { status: 'failed', url: rawText.trim() };
	let url = found;
	try {
		url = canonicalize(found);
	} catch { /* keep found */ }
	try {
		const res = await fetchImpl(url, { headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(10_000) });
		const finalUrl = (() => {
			try { return canonicalize(res.url || url); } catch { return url; }
		})();
		const amazon = isAmazon(new URL(finalUrl).hostname);
		if (!res.ok) {
			const blocked = [401, 403, 429, 503].includes(res.status);
			if (blocked && !amazon && oxylabsEnabled()) {
				const via = await pageViaOxylabs(finalUrl, fetchImpl);
				if (via) return via;
			}
			return { status: amazon && blocked ? 'blocked' : 'failed', url: finalUrl };
		}
		const html = await res.text();
		const r = parseHtml(finalUrl, html);
		if (!amazon && r.status === 'ok' && isChallengeTitle(r.title) && r.priceCents == null) {
			const via = oxylabsEnabled() ? await pageViaOxylabs(finalUrl, fetchImpl) : null;
			return via ?? { status: 'blocked', url: finalUrl };
		}
		return r;
	} catch {
		return { status: 'failed', url };
	}
}
