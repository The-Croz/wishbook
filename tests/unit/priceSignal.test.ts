import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { priceSignal, typicalPrice, type PriceSample } from '../../src/lib/priceSignal';
import { createTestDb, getDb } from '../../src/lib/server/db';
import { items, priceHistory } from '../../src/lib/server/db/schema';
import { createItem } from '../../src/lib/server/lists';
import { recordPrice, withPriceSignals } from '../../src/lib/server/priceHistory';
import { toItemView } from '../../src/lib/server/visibility';
import { makeUser } from './helpers';

const DAY = 86_400_000;
const now = new Date('2027-11-26T15:00:00Z');
/** One sample a day for `days` days ending `endDaysAgo` ago. */
const daily = (days: number, cents: number | ((d: number) => number), endDaysAgo = 1): PriceSample[] =>
	Array.from({ length: days }, (_, i) => ({ priceCents: typeof cents === 'number' ? cents : cents(i), checkedAt: new Date(now.getTime() - (endDaysAgo + i) * DAY) }));

describe('typicalPrice', () => {
	it('needs two weeks of prices spread over three weeks', () => {
		expect(typicalPrice(daily(13, 5000, 4), now)).toBeNull();
		expect(typicalPrice(daily(30, 5000, 4), now)).toBe(5000);
		const bunched = Array.from({ length: 20 }, (_, i) => ({ priceCents: 5000, checkedAt: new Date(now.getTime() - (4 * DAY + i * 3_600_000 * 20)) }));
		expect(typicalPrice(bunched, now)).toBeNull();
	});
	it('ignores the last few days, so an ongoing sale is not "usual"', () => {
		const s = [...daily(30, 5000, 4), ...daily(3, 3000, 0)];
		expect(typicalPrice(s, now)).toBe(5000);
	});
	it('uses the median, so a short spike does not move it', () => {
		expect(typicalPrice(daily(30, (d) => (d < 3 ? 9999 : 5000), 4), now)).toBe(5000);
	});
	it('counts several readings in a day once', () => {
		const sameDay = Array.from({ length: 50 }, () => ({ priceCents: 1000, checkedAt: new Date(now.getTime() - 10 * DAY) }));
		expect(typicalPrice([...daily(25, 5000, 4), ...sameDay], now)).toBe(5000);
	});
});

describe('priceSignal', () => {
	const history = daily(40, 5000, 4);
	it('calls a real drop a deal', () => {
		expect(priceSignal(history, 3999, 7999, now)).toEqual({ kind: 'deal', typicalCents: 5000, pctOff: 20 });
	});
	it('says "usual price" when the store’s "was" price is made up', () => {
		expect(priceSignal(history, 4999, 7999, now)).toEqual({ kind: 'usual', typicalCents: 5000 });
	});
	it('calls a small dip a drop, not a real deal, and says nothing at the usual price', () => {
		expect(priceSignal(history, 4700, 7999, now)).toMatchObject({ kind: 'drop', pctOff: 6 });
		expect(priceSignal(history, 5000, null, now)).toBeNull();
	});
	it('needs $2 off for a real deal on cheap gifts', () => {
		expect(priceSignal(daily(40, 1000, 4), 850, null, now)?.kind).toBe('drop');
	});
	it('falls back to a drop without enough history for a real deal', () => {
		expect(priceSignal(daily(5, 5000, 4), 2000, 7999, now)).toMatchObject({ kind: 'drop', fromCents: 5000, pctOff: 60 });
	});
});

describe('price drops with little history', () => {
	const at = (daysAgo: number, cents: number) => ({ priceCents: cents, checkedAt: new Date(now.getTime() - daysAgo * DAY) });
	it('flags a drop from the day before', () => {
		expect(priceSignal([at(1, 5000)], 4000, null, now)).toMatchObject({ kind: 'drop', fromCents: 5000, pctOff: 20 });
	});
	it('keeps flagging while the sale lasts', () => {
		expect(priceSignal([at(5, 5000), at(4, 4000), at(3, 4000), at(1, 4000)], 4000, null, now)).toMatchObject({ kind: 'drop', fromCents: 5000 });
	});
	it('is not a drop if it was cheaper just before', () => {
		expect(priceSignal([at(3, 5000), at(1, 3500)], 4000, null, now)).toBeNull();
	});
	it('ignores today’s own reading and tiny changes', () => {
		expect(priceSignal([at(0, 5000)], 4000, null, now)).toBeNull();
		expect(priceSignal([at(1, 5000)], 4900, null, now)).toBeNull();
		expect(priceSignal([at(1, 1000)], 940, null, now)).toBeNull();
	});
	it('prefers "real deal" when there is enough history', () => {
		expect(priceSignal([...daily(40, 5000, 4), at(1, 4500)], 4000, null, now)).toMatchObject({ kind: 'deal' });
	});
});

describe('price history', () => {
	beforeEach(() => createTestDb());
	const rows = (id: number) => getDb().select().from(priceHistory).where(eq(priceHistory.itemId, id)).all();

	it('records the saved price and one reading per day', () => {
		const u = makeUser('josh');
		const i = createItem(u, u.id, { title: 'K', url: 'https://ex.com/k', priceCents: 5000, scrapeStatus: 'ok' }, 2027);
		expect(rows(i.id)).toHaveLength(1);
		recordPrice(i, 4800, new Date());
		expect(rows(i.id).map((r) => r.priceCents)).toEqual([4800]);
		recordPrice(i, 4700, new Date(Date.now() + DAY));
		expect(rows(i.id)).toHaveLength(2);
	});
	it('keeps the old price when an older gift is first read', () => {
		const u = makeUser('josh');
		const i = createItem(u, u.id, { title: 'K', url: 'https://ex.com/k', priceCents: 5000 }, 2027);
		const old = new Date(Date.now() - 10 * DAY);
		getDb().update(items).set({ createdAt: old }).where(eq(items.id, i.id)).run();
		recordPrice({ ...i, createdAt: old }, 4000, new Date());
		expect(rows(i.id).map((r) => r.priceCents)).toEqual([5000, 4000]);
	});
	it('pools history across gifts with the same link', () => {
		const u = makeUser('josh');
		const old = createItem(u, u.id, { title: 'K', url: 'https://ex.com/k', priceCents: 5000 }, 2026);
		for (let d = 40; d >= 5; d--) getDb().insert(priceHistory).values({ itemId: old.id, priceCents: 5000, checkedAt: new Date(Date.now() - d * DAY) }).run();
		const fresh = createItem(u, u.id, { title: 'K', url: 'https://ex.com/k', priceCents: 3500, scrapeStatus: 'ok' }, 2027);
		const [v] = withPriceSignals([toItemView(u, u.id, fresh, [])]);
		expect(v.priceSignal).toEqual({ kind: 'deal', typicalCents: 5000, pctOff: 30 });
	});
	it('does not mix gifts that only link to a store homepage', () => {
		const u = makeUser('josh');
		const other = createItem(u, u.id, { title: 'Other', url: 'https://ex.com', priceCents: 9000 }, 2027);
		for (let d = 40; d >= 5; d--) getDb().insert(priceHistory).values({ itemId: other.id, priceCents: 9000, checkedAt: new Date(Date.now() - d * DAY) }).run();
		const mine = createItem(u, u.id, { title: 'Mine', url: 'https://ex.com/', priceCents: 3500, scrapeStatus: 'ok' }, 2027);
		const [v] = withPriceSignals([toItemView(u, u.id, mine, [])]);
		expect(v.priceSignal).toBeUndefined();
	});
});
