import type { CheerioAPI } from 'cheerio';
import { parsePrice } from '$lib/money';
import type { ScrapeResult } from './index';

export function isRobotCheck($: CheerioAPI, html: string): boolean {
	return $('form[action*="validateCaptcha"]').length > 0 || /api-services-support@amazon\.com|not a robot/i.test(html);
}

function largestDynamicImage(attr: string | undefined): string | undefined {
	if (!attr) return undefined;
	try {
		const map = JSON.parse(attr) as Record<string, [number, number]>;
		return Object.entries(map).sort((a, b) => b[1][0] * b[1][1] - a[1][0] * a[1][1])[0]?.[0];
	} catch {
		return undefined;
	}
}

/** Amazon's price, trying the hidden text, then the visible whole/fraction pieces, then the buying-options JSON. */
function readPrice($: CheerioAPI, html: string): { cents: number; currency: string } | null {
	const boxes = ['.priceToPay', '#corePrice_feature_div .a-price', '#corePriceDisplay_desktop_feature_div .a-price:not(.a-text-price)', '#apex_desktop .a-price:not(.a-text-price)'];
	for (const sel of boxes) {
		const box = $(sel).first();
		if (!box.length) continue;
		const hidden = parsePrice(box.find('.a-offscreen').first().text());
		if (hidden) return hidden;
		const whole = box.find('.a-price-whole').first().text().replace(/[^\d]/g, '');
		const frac = box.find('.a-price-fraction').first().text().replace(/[^\d]/g, '') || '00';
		const sym = box.find('.a-price-symbol').first().text().trim() || '$';
		if (whole) return parsePrice(`${sym}${whole}.${frac}`);
	}
	const amount = html.match(/"priceAmount"\s*:\s*([\d.]+)/)?.[1];
	if (amount) return parsePrice(amount);
	const inside = parsePrice($('#price_inside_buybox').first().text());
	return inside;
}

export function parseAmazon(url: string, $: CheerioAPI, html: string): ScrapeResult {
	if (isRobotCheck($, html)) return { status: 'blocked', url };
	const result: ScrapeResult = { status: 'ok', url, store: 'Amazon' };
	const title = $('#productTitle').first().text().replace(/\s+/g, ' ').trim();
	if (title) result.title = title;
	const price = readPrice($, html);
	if (price) {
		result.priceCents = price.cents;
		result.currency = price.currency;
	}
	const listText = $('.basisPrice .a-offscreen').first().text();
	const list = listText ? parsePrice(listText) : null;
	if (list && price && list.cents > price.cents) result.listPriceCents = list.cents;
	const img = $('#landingImage');
	const src = img.attr('data-old-hires') || largestDynamicImage(img.attr('data-a-dynamic-image')) || img.attr('src');
	if (src) result.imageUrl = src;
	if (!result.title) return { status: 'blocked', url };
	return result;
}
