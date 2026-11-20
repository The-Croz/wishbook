import { describe, expect, it } from 'vitest';
import { christmasCountdown, currentSeason, showReceived } from '../../src/lib/season';

describe('currentSeason', () => {
	it('is this year during the fall', () => expect(currentSeason(new Date(2026, 10, 19))).toBe(2026));
	it('stays on last Christmas through Jan 15', () => expect(currentSeason(new Date(2027, 0, 10))).toBe(2026));
	it('moves on after Jan 15', () => expect(currentSeason(new Date(2027, 0, 16))).toBe(2027));
});

describe('showReceived', () => {
	it('is off before December', () => expect(showReceived(new Date(2026, 10, 30))).toBe(false));
	it('is on from Dec 1', () => expect(showReceived(new Date(2026, 11, 1))).toBe(true));
	it('is on through Jan 15', () => expect(showReceived(new Date(2027, 0, 15))).toBe(true));
	it('is off after Jan 15', () => expect(showReceived(new Date(2027, 0, 16))).toBe(false));
});

describe('christmasCountdown', () => {
	it('counts days to Dec 25 of the current season', () => expect(christmasCountdown(new Date(2026, 10, 20, 9))).toEqual({ season: 2026, daysToGo: 35 }));
	it('is 0 on Christmas Day', () => expect(christmasCountdown(new Date(2026, 11, 25, 15)).daysToGo).toBe(0));
	it('goes negative after Christmas', () => expect(christmasCountdown(new Date(2026, 11, 27)).daysToGo).toBeLessThan(0));
});
