import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../../src/lib/server/db';
import { lookupAmazon, oxylabsCallsThisMonth, parseOxylabs } from '../../src/lib/server/scrape/oxylabs';
import { scrape } from '../../src/lib/server/scrape';
import { readFileSync } from 'node:fs';

const fx = (n: string) => readFileSync(new URL(`../fixtures/${n}`, import.meta.url), 'utf8');
const URL1 = 'https://www.amazon.com/dp/1546000429';
const product = { results: [{ content: { title: ' Little  Blue Truck ', price: 8.99, price_strikethrough: 12.99, currency: 'USD', images: ['https://m.media-amazon.com/images/I/a.jpg'] } }] };

/** Amazon serves the captcha; Oxylabs answers with `oxy`. Records Oxylabs calls. */
function fakeNet(oxy: unknown, oxyStatus = 200) {
	const calls: { body: any; auth: string }[] = [];
	const f = (async (url: string, init?: RequestInit) => {
		if (String(url).includes('oxylabs')) {
			calls.push({ body: JSON.parse(String(init!.body)), auth: (init!.headers as Record<string, string>).Authorization });
			return { ok: oxyStatus < 400, status: oxyStatus, json: async () => oxy } as unknown as Response;
		}
		return { ok: true, status: 200, url, text: async () => fx('amazon-captcha.html') } as unknown as Response;
	}) as unknown as typeof fetch;
	return { f, calls };
}

beforeEach(() => { createTestDb(); process.env.OXYLABS_API_KEY = 'k'; delete process.env.OXYLABS_MONTHLY_LIMIT; });
afterEach(() => { delete process.env.OXYLABS_API_KEY; });

describe('parseOxylabs', () => {
	it('reads the real Web API layout (results[0].json), ignoring ads', () => {
		const real = { state: 'done', results: [{ json: {
			ads: [{ asin: '0824956842', title: 'Some other book', price: 6.51, images: ['https://img/ad.jpg'] }],
			asin: '1546000429', title: 'Little Blue Truck', images: ['https://m.media-amazon.com/images/I/main.jpg'],
			buybox: [{ price: 25.9 }, { price: 35.16 }]
		} }] };
		expect(parseOxylabs(URL1, real)).toMatchObject({ title: 'Little Blue Truck', priceCents: 2590, imageUrl: 'https://m.media-amazon.com/images/I/main.jpg' });
	});
	it('reads title, price, list price and image', () =>
		expect(parseOxylabs(URL1, product)).toEqual({ status: 'ok', url: URL1, store: 'Amazon', title: 'Little Blue Truck', priceCents: 899, listPriceCents: 1299, currency: 'USD', imageUrl: 'https://m.media-amazon.com/images/I/a.jpg' }));
	it('accepts an unwrapped product and string prices', () =>
		expect(parseOxylabs(URL1, { title: 'X', price: '$5.00' })).toMatchObject({ title: 'X', priceCents: 500 }));
	it('gives null without a title', () => expect(parseOxylabs(URL1, { results: [{ content: {} }] })).toBeNull());
});

describe('scrape with Oxylabs', () => {
	it('falls back to Oxylabs when Amazon blocks', async () => {
		const { f, calls } = fakeNet(product);
		const r = await scrape('https://www.amazon.com/gp/product/1546000429/ref=x?th=1', f);
		expect(r).toMatchObject({ status: 'ok', title: 'Little Blue Truck', priceCents: 899 });
		expect(calls[0]).toEqual({ body: { query: '1546000429', domain: 'com', output: ['json'] }, auth: 'Bearer k' });
		expect(oxylabsCallsThisMonth()).toBe(1);
	});
	it('stays blocked when Oxylabs fails', async () => {
		const { f } = fakeNet({}, 500);
		expect((await scrape(URL1, f)).status).toBe('blocked');
	});
	it('does nothing without a key', async () => {
		delete process.env.OXYLABS_API_KEY;
		const { f, calls } = fakeNet(product);
		expect((await scrape(URL1, f)).status).toBe('blocked');
		expect(calls).toHaveLength(0);
	});
	it('stops at the monthly limit', async () => {
		process.env.OXYLABS_MONTHLY_LIMIT = '1';
		const { f, calls } = fakeNet(product);
		await lookupAmazon(URL1, f);
		expect(await lookupAmazon(URL1, f)).toBeNull();
		expect(calls).toHaveLength(1);
	});
});

describe('stores that bot-block us (non-Amazon)', () => {
	const html = '<html><head><title>x</title><script type="application/ld+json">{"@type":"Product","name":"Scrubee","image":"http://img/s.png","offers":{"@type":"Offer","price":13,"priceCurrency":"USD"}}</script></head></html>'.padEnd(300, ' ');
	const net = (directStatus: number, directHtml = '') => {
		const calls: any[] = [];
		const f = (async (url: string, init?: RequestInit) => {
			if (String(url).includes('oxylabs')) { calls.push(JSON.parse(String(init!.body))); return { ok: true, status: 200, json: async () => ({ results: [{ html }] }) } as unknown as Response; }
			return { ok: directStatus < 400, status: directStatus, url, text: async () => directHtml } as unknown as Response;
		}) as unknown as typeof fetch;
		return { f, calls };
	};
	it('reads a 403 page through Oxylabs', async () => {
		const { f, calls } = net(403);
		expect(await scrape('https://www.lush.com/us/en_us/p/scrubee', f)).toMatchObject({ status: 'ok', title: 'Scrubee', priceCents: 1300, imageUrl: 'https://img/s.png' });
		expect(calls[0]).toMatchObject({ url: 'https://www.lush.com/us/en_us/p/scrubee', output: ['html'] });
	});
	it('treats a 200 challenge page as blocked and goes through Oxylabs', async () => {
		const { f } = net(200, '<html><head><title>Just a moment...</title></head></html>');
		expect(await scrape('https://www.lush.com/p/x', f)).toMatchObject({ status: 'ok', title: 'Scrubee' });
	});
	it('stays blocked/failed without a key', async () => {
		delete process.env.OXYLABS_API_KEY;
		const { f } = net(200, '<html><head><title>Just a moment...</title></head></html>');
		expect((await scrape('https://www.lush.com/p/x', f)).status).toBe('blocked');
		expect((await scrape('https://www.lush.com/p/x', net(403).f)).status).toBe('failed');
	});
});
