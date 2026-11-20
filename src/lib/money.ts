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
