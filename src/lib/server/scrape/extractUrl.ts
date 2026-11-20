/** First link in pasted text (share messages often wrap the URL in prose). */
export function extractUrl(text: string): string | null {
	const m = text.match(/https?:\/\/[^\s<>"']+/i) ?? text.match(/\bwww\.[^\s<>"']+/i);
	if (!m) return null;
	let url = m[0].replace(/[.,;:!?)\]}'"]+$/, '');
	if (!/^https?:/i.test(url)) url = `https://${url}`;
	try {
		return new URL(url).toString().replace(/\/$/, url.endsWith('/') ? '/' : '');
	} catch {
		return null;
	}
}

const TRACKING = /^(utm_.*|ref|ref_|tag|psc|th|smid|spLa|linkCode|linkId|camp|creative|creativeASIN|ascsubtag|fbclid|gclid|mc_cid|mc_eid|_encoding|pd_rd_.*|pf_rd_.*|qid|sr|keywords|crid|sprefix|dib|dib_tag|content-id)$/i;

export function isAmazon(host: string): boolean {
	return /(^|\.)amazon\.[a-z.]+$/i.test(host) || /^(a\.co|amzn\.to|amzn\.com)$/i.test(host);
}

export function canonicalize(raw: string): string {
	const u = new URL(raw);
	if (isAmazon(u.hostname)) {
		const asin = u.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/ASIN)\/([A-Z0-9]{10})/i)?.[1];
		if (asin) {
			const host = u.hostname.replace(/^(smile\.|m\.)?(www\.)?/, 'www.');
			return `https://${host}/dp/${asin.toUpperCase()}`;
		}
	}
	for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
	u.hash = '';
	return u.toString();
}

/** The stand-in name for a gift saved before its page could be read. */
export function placeholderTitle(url: string): string {
	return `Gift from ${new URL(url).hostname.replace(/^www\./, '')}`;
}

export const isPlaceholderTitle = (title: string): boolean => /^Gift from [^\s/]+\.[a-z.]+$/i.test(title.trim());

/**
 * The product name from a share message ("Check out LEGO Bonsai on Amazon https://a.co/…"),
 * for when the page itself can't be read. Undefined unless something name-like is left.
 */
export function titleFromShareText(text: string): string | undefined {
	const prose = text
		.replace(/https?:\/\/[^\s<>"']+/gi, ' ')
		.replace(/\bwww\.[^\s<>"']+/gi, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/^(check out|look at|take a look at)\b\s*(this|these)?\s*(deal|item|product|find|one)?\s*:?\s*/i, '')
		.replace(/^amazon(\.com)?\s*:\s*/i, '')
		.replace(/\s+(on|at|from)\s+amazon(\.com)?\s*$/i, '')
		.replace(/^["“'\s:,-]+|["”'\s:,-]+$/g, '');
	return prose.length >= 8 ? prose.slice(0, 200) : undefined;
}
