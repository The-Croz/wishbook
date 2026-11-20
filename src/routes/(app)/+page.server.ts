import { getFamily } from '$lib/server/lists';
import { getMyClaims } from '$lib/server/claims';
import { christmasCountdown } from '$lib/season';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const { season, daysToGo } = christmasCountdown(new Date());
	// A short "I'm getting" summary for the wide layout's side column.
	const mine = getMyClaims(locals.user!, season).filter((c) => !c.removed);
	const getting = {
		count: mine.length,
		total: mine.reduce((s, c) => s + (c.priceCents ?? 0), 0),
		recent: mine.slice(0, 3).map((c) => ({ id: c.id, title: c.title, imageUrl: c.imageUrl, store: c.store, ownerName: c.ownerName, priceCents: c.priceCents, currency: c.currency, purchased: Boolean(c.claim?.purchased) }))
	};
	return { family: getFamily(locals.user!, season), season, daysToGo, getting };
};
