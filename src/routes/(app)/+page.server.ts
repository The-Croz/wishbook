import { getFamily } from '$lib/server/lists';
import { getMyClaims } from '$lib/server/claims';
import { christmasCountdown } from '$lib/season';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const { season, daysToGo } = christmasCountdown(new Date());
	// A short "I'm buying" summary for the wide layout's side column.
	const mine = getMyClaims(locals.user!, season).filter((c) => !c.removed);
	const getting = {
		count: mine.length,
		total: mine.reduce((s, c) => s + (c.priceCents ?? 0) * c.mine.quantity, 0),
		recent: mine.slice(0, 3).map((c) => ({ id: c.id, title: c.title, imageUrl: c.imageUrl, store: c.store, ownerName: c.ownerName, priceCents: c.priceCents, currency: c.currency, purchased: c.mine.purchased, quantity: c.mine.quantity }))
	};
	return { family: getFamily(locals.user!, season), season, daysToGo, getting };
};
