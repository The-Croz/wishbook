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
