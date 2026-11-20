import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { items, lists } from '$lib/server/db/schema';
import { isRefreshRunning, refreshNow } from '$lib/server/prices';
import { currentSeason } from '$lib/season';
import { requireAdmin } from '$lib/server/admin';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const rows = getDb().select({ status: items.scrapeStatus, n: sql<number>`count(*)` }).from(items)
		.innerJoin(lists, eq(lists.id, items.listId))
		.where(and(eq(lists.season, currentSeason(new Date())), isNull(items.deletedAt), isNotNull(items.url), eq(items.status, 'active')))
		.groupBy(items.scrapeStatus).all();
	const counts = Object.fromEntries(rows.map((r) => [r.status, r.n])) as Record<string, number>;
	return { counts, running: isRefreshRunning(), disabled: process.env.DISABLE_PRICE_REFRESH === '1' };
};

export const actions: Actions = {
	refresh: ({ locals }) => {
		requireAdmin(locals.user!);
		return { started: refreshNow() };
	}
};
