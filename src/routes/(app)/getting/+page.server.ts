import { error } from '@sveltejs/kit';
import { getMyClaims, setPurchased } from '$lib/server/claims';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const claims = getMyClaims(locals.user!);
	const groups = new Map<number, { ownerId: number; ownerName: string; total: number; items: typeof claims }>();
	for (const c of claims) {
		const g = groups.get(c.ownerId) ?? { ownerId: c.ownerId, ownerName: c.ownerName, total: 0, items: [] };
		g.items.push(c);
		if (!c.removed && c.priceCents) g.total += c.priceCents * c.mine.quantity;
		groups.set(c.ownerId, g);
	}
	const all = [...groups.values()];
	const live = claims.filter((c) => !c.removed);
	return { groups: all, bought: live.filter((c) => c.mine.purchased).length, live: live.length, grandTotal: all.reduce((s, g) => s + g.total, 0), count: claims.filter((c) => !c.removed).reduce((n, c) => n + c.mine.quantity, 0) };
};

export const actions: Actions = {
	/** The "bought" checkbox on each row, so you can tick gifts off without opening them. */
	purchased: async ({ locals, request }) => {
		const form = await request.formData();
		const itemId = Number(form.get('itemId'));
		if (!Number.isInteger(itemId) || itemId <= 0) error(400, 'Unknown gift');
		setPurchased(locals.user!, itemId, form.get('purchased') === 'on');
	}
};
