import { describe, expect, it } from 'vitest';
import { formatMoney, parsePrice } from '../../src/lib/money';

describe('money', () => {
	it('formats cents', () => expect(formatMoney(14999, 'USD')).toBe('$149.99'));
	it('parses dollars with commas', () => expect(parsePrice('$1,249.00')).toEqual({ cents: 124900, currency: 'USD' }));
	it('parses pounds', () => expect(parsePrice('£24.50')).toEqual({ cents: 2450, currency: 'GBP' }));
	it('parses bare numbers as USD', () => expect(parsePrice('79.9')).toEqual({ cents: 7990, currency: 'USD' }));
	it('rejects text without a price', () => expect(parsePrice('See price in cart')).toBeNull());
});
