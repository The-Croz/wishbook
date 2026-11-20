/** One-time import of a public Elfster wish list, read from Elfster's own list endpoint. */
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from './db';
import { items, type User } from './db/schema';
import { requireAdmin } from './admin';
import { ensureSeasonList, type Priority } from './lists';
import { canonicalize, isAmazon } from './scrape/extractUrl';
import { storeFromHost } from './scrape/generic';
import { currentSeason } from '$lib/season';

export type ElfsterWish = {
	wishId: string;
	title: string;
	description?: string;
	sourceUrl?: string;
	imageUrl?: string;
	price?: { currency: string; amount: number } | null;
	isMostWanted?: boolean;
	quantityReceived?: number;
	sortPriority?: number;
};

export type ImportRow = {
	key: string;
	title: string;
	url: string | null;
	imageUrl: string | null;
	store: string | null;
	priceCents: number | null;
	currency: string;
	notes: string;
	priority: Priority;
	selected: boolean;
	reason?: string;
};

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

export function parseElfsterLink(text: string): string | null {
	const m = text.match(new RegExp(`elfster\\.com/\\S*?wish-lists?/(${UUID})`, 'i'));
	return m ? m[1].toLowerCase() : null;
}

export async function fetchElfsterWishes(wishlistId: string, fetchImpl: typeof fetch = fetch): Promise<ElfsterWish[]> {
	const out: ElfsterWish[] = [];
	for (let offset = 0; offset < 1000; offset += 50) {
		let res: Response;
		try {
			res = await fetchImpl(`https://www.elfster.com/v1/wishlists/${wishlistId}/wishes?limit=50&offset=${offset}`, {
				headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (Wishbook family import)' },
				signal: AbortSignal.timeout(15_000)
			});
		} catch {
			throw new Error('Couldn’t reach Elfster. Try again in a minute.');
		}
		if (!res.ok) throw new Error('Elfster didn’t share that list. Make sure it’s set to public.');
		const page = (await res.json()) as ElfsterWish[];
		if (!Array.isArray(page)) throw new Error('Elfster sent something unexpected.');
		out.push(...page);
		if (page.length < 50) break;
	}
	return out;
}

function cleanUrl(raw?: string): string | null {
	if (!raw || !/^https?:\/\//i.test(raw)) return null;
	try {
		return canonicalize(raw);
	} catch {
		return null;
	}
}

export function toImportRows(wishes: ElfsterWish[]): ImportRow[] {
	const seen = new Set<string>();
	return [...wishes]
		.sort((a, b) => (a.sortPriority ?? 0) - (b.sortPriority ?? 0))
		.map((w) => {
			const url = cleanUrl(w.sourceUrl);
			const host = url ? new URL(url).hostname : null;
			const row: ImportRow = {
				key: w.wishId,
				title: (w.title ?? '').replace(/\s+/g, ' ').trim().slice(0, 200) || 'Untitled gift',
				url,
				imageUrl: w.imageUrl && /^https?:\/\//.test(w.imageUrl) ? w.imageUrl : null,
				store: host ? (isAmazon(host) ? 'Amazon' : storeFromHost(host)) : null,
				priceCents: w.price?.amount != null ? Math.round(w.price.amount * 100) : null,
				currency: w.price?.currency ?? 'USD',
				notes: (w.description ?? '').trim().slice(0, 1000),
				priority: w.isMostWanted ? 'most' : 'want',
				selected: true
			};
			if ((w.quantityReceived ?? 0) > 0) Object.assign(row, { selected: false, reason: 'Already received on Elfster' });
			else if (url && seen.has(url)) Object.assign(row, { selected: false, reason: 'Same link as another gift' });
			if (url) seen.add(url);
			return row;
		});
}

/** Admin-only: adds rows to a person's list. Skips links already on that list. Claims are never imported. */
export function importWishes(admin: User, ownerId: number, rows: ImportRow[], season = currentSeason(new Date())): { added: number; skipped: number } {
	requireAdmin(admin);
	const db = getDb();
	const list = ensureSeasonList(ownerId, season);
	const existing = new Set(
		db.select({ url: items.url }).from(items).where(and(eq(items.listId, list.id), isNull(items.deletedAt))).all()
			.map((r) => r.url).filter((u): u is string => !!u)
	);
	let added = 0, skipped = 0;
	db.transaction((tx) => {
		rows.forEach((r, n) => {
			if (r.url && existing.has(r.url)) { skipped++; return; }
			tx.insert(items).values({
				listId: list.id, title: r.title, url: r.url, imageUrl: r.imageUrl, store: r.store, priceCents: r.priceCents,
				currency: r.currency, notes: r.notes, priority: r.priority, createdBy: admin.id, sortOrder: n,
				scrapeStatus: 'manual'
			}).run();
			if (r.url) existing.add(r.url);
			added++;
		});
	});
	return { added, skipped };
}
