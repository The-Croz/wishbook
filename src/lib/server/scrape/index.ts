import { load } from 'cheerio';
import { canonicalize, extractUrl, isAmazon, titleFromShareText } from './extractUrl';
import { parseAmazon } from './amazon';
import { parseGeneric } from './generic';

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

/** Fetches a pasted link and reads gift details from it. Never throws. */
export async function scrape(rawText: string, fetchImpl: typeof fetch = fetch): Promise<ScrapeResult> {
	const r = await scrapePage(rawText, fetchImpl);
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
		if (!res.ok) {
			const blocked = isAmazon(new URL(finalUrl).hostname) && [403, 429, 503].includes(res.status);
			return { status: blocked ? 'blocked' : 'failed', url: finalUrl };
		}
		const html = await res.text();
		return parseHtml(finalUrl, html);
	} catch {
		return { status: 'failed', url };
	}
}
