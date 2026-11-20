import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb, getDb } from '../../src/lib/server/db';
import { items, priceHistory } from '../../src/lib/server/db/schema';
import { refreshItem, refreshPrices, retryIncomplete } from '../../src/lib/server/prices';
import { createItem, deleteItem } from '../../src/lib/server/lists';
import { makeUser } from './helpers';

const fx = (n: string) => readFileSync(new URL(`../fixtures/${n}`, import.meta.url), 'utf8');
const page = (html: string, status = 200) =>
	(async (url: string) => ({ ok: status < 400, status, url, text: async () => html }) as unknown as Response) as unknown as typeof fetch;
const get = (id: number) => getDb().select().from(items).where(eq(items.id, id)).get()!;

let josh: ReturnType<typeof makeUser>;
beforeEach(() => { createTestDb(); josh = makeUser('josh'); });

const amazonItem = () => createItem(josh, josh.id, {
	title: 'My Kindle', url: 'https://www.amazon.com/dp/B0D7HXJ8QK', imageUrl: 'https://img/old.jpg',
	priceCents: 18999, scrapeStatus: 'ok'
}, 2026);

describe('refreshItem', () => {
	it('updates a changed price and records history', async () => {
		const i = amazonItem();
		expect(await refreshItem(i.id, page(fx('amazon-product.html')))).toBe('ok');
		const after = get(i.id);
		expect(after).toMatchObject({ priceCents: 14999, listPriceCents: 18999, scrapeStatus: 'ok' });
		expect(after.priceCheckedAt!.getTime()).toBeGreaterThan(Date.now() - 5000);
		expect(getDb().select().from(priceHistory).all()).toHaveLength(1);
	});
	it('keeps the user’s own title', async () => {
		const i = amazonItem();
		await refreshItem(i.id, page(fx('amazon-product.html')));
		expect(get(i.id).title).toBe('My Kindle');
	});
	it('records no history when the price is unchanged', async () => {
		const i = amazonItem();
		await refreshItem(i.id, page(fx('amazon-product.html')));
		await refreshItem(i.id, page(fx('amazon-product.html')));
		expect(getDb().select().from(priceHistory).all()).toHaveLength(1);
	});
	it('leaves everything alone when blocked', async () => {
		const i = amazonItem();
		const before = get(i.id);
		expect(await refreshItem(i.id, page(fx('amazon-captcha.html')))).toBe('blocked');
		const after = get(i.id);
		expect(after).toMatchObject({ title: before.title, imageUrl: before.imageUrl, priceCents: 18999, scrapeStatus: 'blocked' });
		expect(after.priceCheckedAt?.getTime()).toBe(before.priceCheckedAt?.getTime());
	});
	it('never blanks a price when the page shows none', async () => {
		const i = amazonItem();
		await refreshItem(i.id, page(fx('amazon-noprice.html')));
		expect(get(i.id).priceCents).toBe(18999);
	});
	it('replaces the “Gift from amazon.com” placeholder with the real name', async () => {
		const i = createItem(josh, josh.id, { title: 'Gift from amazon.com', url: 'https://www.amazon.com/dp/B0D7HXJ8QK', scrapeStatus: 'blocked' }, 2026);
		await refreshItem(i.id, page(fx('amazon-product.html')));
		expect(get(i.id).title).toBe('Amazon Kindle Paperwhite Signature Edition (32 GB) – Metallic Jade');
	});
	it('fills a missing image', async () => {
		const i = createItem(josh, josh.id, { title: 'K', url: 'https://www.amazon.com/dp/B0D7HXJ8QK', scrapeStatus: 'blocked' }, 2026);
		await refreshItem(i.id, page(fx('amazon-product.html')));
		expect(get(i.id).imageUrl).toBe('https://m.media-amazon.com/images/I/61big._AC_SL1500_.jpg');
	});
});

describe('refreshPrices', () => {
	it('checks only live gifts with links this season', async () => {
		const a = amazonItem();
		const gone = amazonItem();
		deleteItem(josh, gone.id);
		createItem(josh, josh.id, { title: 'No link' }, 2026);
		const r = await refreshPrices(page(fx('amazon-product.html')), { season: 2026, delayMs: () => 0 });
		expect(r).toEqual({ checked: 1, changed: 1, blocked: 0, failed: 0 });
		expect(get(a.id).priceCents).toBe(14999);
		expect(get(gone.id).priceCents).toBe(18999);
	});
});

describe('retryIncomplete', () => {
	it('retries only blocked gifts still missing details, and fills them in', async () => {
		const stuck = createItem(josh, josh.id, { title: 'Gift from amazon.com', url: 'https://www.amazon.com/dp/B0D7HXJ8QK', scrapeStatus: 'blocked' }, 2026);
		const done = amazonItem();
		const r = await retryIncomplete(page(fx('amazon-product.html')), { season: 2026, delayMs: () => 0 });
		expect(r).toEqual({ checked: 1, fixed: 1 });
		expect(get(stuck.id)).toMatchObject({ title: 'Amazon Kindle Paperwhite Signature Edition (32 GB) – Metallic Jade', priceCents: 14999, scrapeStatus: 'ok' });
		expect(get(done.id).priceCents).toBe(18999);
	});
	it('skips a blocked gift the owner already filled in by hand', async () => {
		createItem(josh, josh.id, { title: 'Kindle', url: 'https://www.amazon.com/dp/B0D7HXJ8QK', imageUrl: 'https://img/x.jpg', priceCents: 100, scrapeStatus: 'blocked' }, 2026);
		expect(await retryIncomplete(page(fx('amazon-product.html')), { season: 2026, delayMs: () => 0 })).toEqual({ checked: 0, fixed: 0 });
	});
	it('checks at most the limit per run', async () => {
		for (let n = 0; n < 4; n++) createItem(josh, josh.id, { title: 'Gift from amazon.com', url: 'https://www.amazon.com/dp/B0D7HXJ8QK', scrapeStatus: 'blocked' }, 2026);
		const r = await retryIncomplete(page(fx('amazon-captcha.html')), { season: 2026, limit: 2, delayMs: () => 0 });
		expect(r).toEqual({ checked: 2, fixed: 0 });
	});
});
