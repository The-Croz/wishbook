const SYMBOLS: Record<string, string> = { $: 'USD', '£': 'GBP', '€': 'EUR', '¥': 'JPY' };

export function formatMoney(cents: number, currency = 'USD'): string {
	return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

export function parsePrice(text: string): { cents: number; currency: string } | null {
	const m = text.match(/([$£€¥])?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/);
	if (!m) return null;
	const value = Number(m[2].replace(/,/g, ''));
	if (!Number.isFinite(value)) return null;
	return { cents: Math.round(value * 100), currency: m[1] ? SYMBOLS[m[1]] : 'USD' };
}

/** What someone typed in a money box: "" is no amount, "$1,234.5" is 123450. Undefined if it isn't money. */
export function parseCents(text: string | null | undefined): number | null | undefined {
	const t = (text ?? '').trim();
	if (!t) return null;
	if (!/^\$?\s*[\d,]*(\.\d{0,2})?$/.test(t) || !/\d/.test(t)) return undefined;
	return Math.round(Number(t.replace(/[$,\s]/g, '')) * 100);
}

/** Cents as an amount to edit: 2400 → "24", 2450 → "24.50". */
export function centsToInput(cents: number | null | undefined): string {
	if (cents == null) return '';
	return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}
