import type { CheerioAPI } from 'cheerio';
import { parsePrice } from '$lib/money';
import type { ScrapeResult } from './index';

type LdNode = Record<string, unknown>;

function* walk(node: unknown): Generator<LdNode> {
	if (Array.isArray(node)) for (const n of node) yield* walk(n);
	else if (node && typeof node === 'object') {
		yield node as LdNode;
		if ('@graph' in node) yield* walk((node as LdNode)['@graph']);
	}
}

const isProduct = (n: LdNode) => {
	const t = n['@type'];
	return t === 'Product' || (Array.isArray(t) && t.includes('Product'));
};

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

function firstImage(img: unknown): string | undefined {
	if (typeof img === 'string') return img;
	if (Array.isArray(img)) return firstImage(img[0]);
	if (img && typeof img === 'object' && 'url' in img) return String((img as LdNode).url);
}

function offerPrices(offers: unknown): { cents: number; currency: string }[] {
	const out: { cents: number; currency: string }[] = [];
	for (const o of walk(offers)) {
		const p = o.price ?? o.lowPrice;
		if (p == null) continue;
		const parsed = parsePrice(String(p));
		if (parsed) out.push({ cents: parsed.cents, currency: String(o.priceCurrency ?? parsed.currency) });
	}
	return out;
}

const absolute = (src: string | undefined, base: string) => {
	if (!src) return undefined;
	try {
		return new URL(src.startsWith('//') ? `https:${src}` : src, base).toString();
	} catch {
		return undefined;
	}
};

export function storeFromHost(host: string): string {
	const h = host.replace(/^www\./, '');
	const known: Record<string, string> = { 'target.com': 'Target', 'walmart.com': 'Walmart', 'etsy.com': 'Etsy', 'rei.com': 'REI', 'bestbuy.com': 'Best Buy', 'lego.com': 'LEGO', 'kohls.com': "Kohl's", 'costco.com': 'Costco' };
	if (known[h]) return known[h];
	const parts = h.split('.');
	const tail = parts.length > 2 && parts.at(-2)!.length <= 3 ? 3 : 2;
	const name = parts.length >= tail ? parts[parts.length - tail] : parts[0];
	return name.charAt(0).toUpperCase() + name.slice(1);
}

export function parseGeneric(url: string, $: CheerioAPI): ScrapeResult {
	const meta = (k: string) => $(`meta[property="${k}"], meta[name="${k}"]`).attr('content')?.trim() || undefined;
	let product: LdNode | undefined;
	$('script[type="application/ld+json"]').each((_, el) => {
		if (product) return;
		try {
			for (const n of walk(JSON.parse($(el).text()))) if (isProduct(n)) { product = n; break; }
		} catch { /* bad JSON-LD is common; ignore */ }
	});

	const result: ScrapeResult = { status: 'ok', url, store: meta('og:site_name') ?? storeFromHost(new URL(url).hostname) };
	const title = (product?.name as string | undefined) ?? meta('og:title') ?? $('title').first().text();
	if (title) result.title = decode(title);
	result.imageUrl = absolute(firstImage(product?.image) ?? meta('og:image') ?? meta('twitter:image'), url);

	const prices = product ? offerPrices(product.offers) : [];
	if (prices.length) {
		const low = prices.reduce((a, b) => (b.cents < a.cents ? b : a));
		result.priceCents = low.cents;
		result.currency = low.currency;
	} else {
		const amount = meta('product:price:amount') ?? meta('og:price:amount');
		const parsed = amount ? parsePrice(amount) : null;
		if (parsed) {
			result.priceCents = parsed.cents;
			result.currency = meta('product:price:currency') ?? meta('og:price:currency') ?? parsed.currency;
		}
	}
	if (!result.imageUrl) delete result.imageUrl;
	return result;
}
