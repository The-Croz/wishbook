/**
 * Is today's price actually a sale? We judge it against the gift's own price history,
 * never against the store's "was" price, which stores inflate.
 */
export type PriceSample = { priceCents: number; checkedAt: Date | number };

export type PriceSignal =
	/** Clearly below what it usually sells for. */
	| { kind: 'deal'; typicalCents: number; pctOff: number }
	/** Cheaper than the last price we saw before it fell. Works from the second day we watch a gift. */
	| { kind: 'drop'; fromCents: number; since: number; pctOff: number }
	/** The store shows a "was" price, but this is what it normally costs. */
	| { kind: 'usual'; typicalCents: number };

const DAY = 86_400_000;
/** Look back this far for the usual price. */
export const LOOKBACK_DAYS = 120;
/** Ignore the last few days so a sale that's already running doesn't count as "usual". */
const RECENT_DAYS = 3;
/** Need this many days of prices, spread over at least SPAN_DAYS, before we say anything. */
export const MIN_DAYS = 14;
const SPAN_DAYS = 21;
/** A deal is at least this far below usual, and saves at least MIN_SAVING_CENTS. */
const DEAL_PCT = 10;
const MIN_SAVING_CENTS = 200;
/** A drop counts from this much, and from DROP_MIN_CENTS, so pennies of drift don't. */
const DROP_PCT = 5;
const DROP_MIN_CENTS = 100;
/** How far back a drop is measured from. */
const DROP_LOOKBACK_DAYS = 30;
/** "Usual price" when the store claims a discount but we're within this of usual. */
const USUAL_PCT = 5;

const dayOf = (t: Date | number) => Math.floor((typeof t === 'number' ? t : t.getTime()) / DAY);

function median(xs: number[]): number {
	const s = [...xs].sort((a, b) => a - b);
	const m = s.length >> 1;
	return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/** The price it usually sells for, or null if we haven't watched it long enough. */
export function typicalPrice(samples: PriceSample[], now: Date): number | null {
	const today = dayOf(now);
	const byDay = new Map<number, number>();
	for (const s of [...samples].sort((a, b) => +a.checkedAt - +b.checkedAt)) {
		const d = dayOf(s.checkedAt);
		if (d > today - RECENT_DAYS && d <= today) continue;
		if (d < today - LOOKBACK_DAYS || d > today) continue;
		byDay.set(d, s.priceCents); // last reading of the day wins
	}
	if (byDay.size < MIN_DAYS) return null;
	const days = [...byDay.keys()];
	if (Math.max(...days) - Math.min(...days) < SPAN_DAYS) return null;
	return median([...byDay.values()]);
}

/**
 * The price before the current low began: walks back from yesterday past days at
 * today's price to the last day it cost more. If it was cheaper before, there's no drop.
 */
export function dropFrom(samples: PriceSample[], currentCents: number, now: Date): { fromCents: number; since: number } | null {
	const today = dayOf(now);
	const byDay = new Map<number, { cents: number; at: number }>();
	for (const s of [...samples].sort((a, b) => +a.checkedAt - +b.checkedAt)) {
		const d = dayOf(s.checkedAt);
		if (d >= today || d < today - DROP_LOOKBACK_DAYS) continue;
		byDay.set(d, { cents: s.priceCents, at: +s.checkedAt });
	}
	for (const d of [...byDay.keys()].sort((a, b) => b - a)) {
		const r = byDay.get(d)!;
		if (r.cents > currentCents) return { fromCents: r.cents, since: r.at };
		if (r.cents < currentCents) return null;
	}
	return null;
}

export function priceSignal(
	samples: PriceSample[],
	currentCents: number | null,
	listPriceCents: number | null,
	now = new Date()
): PriceSignal | null {
	if (currentCents == null || currentCents <= 0) return null;
	const typical = typicalPrice(samples, now);
	if (typical != null) {
		const saving = typical - currentCents;
		const pctOff = Math.round((saving / typical) * 100);
		if (pctOff >= DEAL_PCT && saving >= MIN_SAVING_CENTS) return { kind: 'deal', typicalCents: typical, pctOff };
	}
	const drop = dropFrom(samples, currentCents, now);
	if (drop) {
		const saving = drop.fromCents - currentCents;
		const pctOff = Math.round((saving / drop.fromCents) * 100);
		if (pctOff >= DROP_PCT && saving >= DROP_MIN_CENTS) return { kind: 'drop', ...drop, pctOff };
	}
	if (typical == null) return null;
	const storeClaimsSale = listPriceCents != null && listPriceCents > currentCents * (1 + USUAL_PCT / 100);
	if (storeClaimsSale && currentCents >= typical * (1 - USUAL_PCT / 100)) return { kind: 'usual', typicalCents: typical };
	return null;
}
