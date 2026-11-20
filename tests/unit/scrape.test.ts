import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canonicalize, extractUrl } from '../../src/lib/server/scrape/extractUrl';
import { parseHtml, scrape } from '../../src/lib/server/scrape';

const fx = (n: string) => readFileSync(new URL(`../fixtures/${n}`, import.meta.url), 'utf8');

describe('extractUrl', () => {
	it('pulls the link out of Amazon share text', () =>
		expect(extractUrl('Check out this deal https://a.co/d/3xYz9Q. Thanks')).toBe('https://a.co/d/3xYz9Q'));
	it('returns null with no link', () => expect(extractUrl('socks please')).toBeNull());
	it('accepts a bare domain link', () => expect(extractUrl('www.rei.com/product/123')).toBe('https://www.rei.com/product/123'));
});

describe('canonicalize', () => {
	it('reduces Amazon links to /dp/ASIN', () =>
		expect(canonicalize('https://www.amazon.com/Kindle/dp/B0D7HXJ8QK/ref=sr_1_3?tag=x&psc=1')).toBe('https://www.amazon.com/dp/B0D7HXJ8QK'));
	it('handles /gp/product links', () =>
		expect(canonicalize('https://amazon.com/gp/product/B0CX23V2ZK?th=1')).toBe('https://www.amazon.com/dp/B0CX23V2ZK'));
	it('strips tracking params elsewhere', () =>
		expect(canonicalize('https://shop.example/p/1?utm_source=x&color=red&ref=abc')).toBe('https://shop.example/p/1?color=red'));
});

describe('parseHtml: Amazon', () => {
	it('reads title, price, list price, and big image', () => {
		const r = parseHtml('https://www.amazon.com/dp/B0D7HXJ8QK', fx('amazon-product.html'));
		expect(r).toMatchObject({
			status: 'ok', store: 'Amazon', priceCents: 14999, listPriceCents: 18999, currency: 'USD',
			title: 'Amazon Kindle Paperwhite Signature Edition (32 GB) – Metallic Jade',
			imageUrl: 'https://m.media-amazon.com/images/I/61big._AC_SL1500_.jpg'
		});
	});
	it('falls back to the largest dynamic image and no price', () => {
		const r = parseHtml('https://www.amazon.com/dp/B0X', fx('amazon-noprice.html'));
		expect(r.imageUrl).toBe('https://m.media-amazon.com/images/I/71fire._AC_SL1500_.jpg');
		expect(r.priceCents).toBeUndefined();
		expect(r.status).toBe('ok');
	});
	it('reads the price from the whole/fraction pieces in the newer layout', () => {
		const r = parseHtml('https://www.amazon.com/dp/B0CFPJYX7P', fx('amazon-apex.html'));
		expect(r).toMatchObject({ priceCents: 12999, listPriceCents: 19999, currency: 'USD', title: 'Amazon Kindle Paperwhite 16GB (2024 model) – Black' });
	});
	it('falls back to the buying-options price data', () => {
		expect(parseHtml('https://www.amazon.com/dp/B0X', fx('amazon-twister-only.html')).priceCents).toBe(1850);
	});
	it('detects the robot check', () => {
		const r = parseHtml('https://www.amazon.com/dp/B0X', fx('amazon-captcha.html'));
		expect(r.status).toBe('blocked');
		expect(r.title).toBeUndefined();
	});
});

describe('parseHtml: other stores', () => {
	it('reads Open Graph product price', () =>
		expect(parseHtml('https://woolly.example/p/socks', fx('og-shopify.html'))).toMatchObject({
			status: 'ok', title: 'Merino Slipper Socks', store: 'Woolly Co.', priceCents: 2400,
			imageUrl: 'https://woolly.example/cdn/shop/products/socks.jpg?v=1'
		}));
	it('prefers JSON-LD Product and takes the lowest offer', () =>
		expect(parseHtml('https://www.target.com/p/x', fx('jsonld-target.html'))).toMatchObject({
			title: 'Fisher-Price Laugh & Learn Puppy', priceCents: 2499, store: 'Target',
			imageUrl: 'https://target.scene7.com/is/image/Target/GUEST_1'
		}));
	it('falls back to the page title', () =>
		expect(parseHtml('https://crafts.example/x', fx('no-metadata.html'))).toMatchObject({
			status: 'ok', title: "Handmade Ornament Set | Grandma's Craft Shop", store: 'Crafts.example'
		}));
});

describe('scrape', () => {
	it('never throws when the fetch fails', async () => {
		const r = await scrape('https://x.example/p', async () => { throw new Error('boom'); });
		expect(r).toMatchObject({ status: 'failed', url: 'https://x.example/p' });
	});
	it('fails cleanly with no link', async () => expect((await scrape('just words')).status).toBe('failed'));
	it('follows the final URL and canonicalizes it', async () => {
		const fake = async () => ({ ok: true, status: 200, url: 'https://www.amazon.com/Kindle/dp/B0D7HXJ8QK/ref=x', text: async () => fx('amazon-product.html') }) as unknown as Response;
		const r = await scrape('look https://a.co/d/abc', fake);
		expect(r.url).toBe('https://www.amazon.com/dp/B0D7HXJ8QK');
		expect(r.priceCents).toBe(14999);
	});
	it('treats a 503 from Amazon as blocked', async () => {
		const fake = async () => ({ ok: false, status: 503, url: 'https://www.amazon.com/dp/B0X', text: async () => '' }) as unknown as Response;
		expect((await scrape('https://www.amazon.com/dp/B0X', fake)).status).toBe('blocked');
	});
});
