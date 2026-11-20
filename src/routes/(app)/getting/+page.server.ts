import { getMyClaims } from '$lib/server/claims';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const claims = getMyClaims(locals.user!);
	const groups = new Map<number, { ownerId: number; ownerName: string; total: number; items: typeof claims }>();
	for (const c of claims) {
		const g = groups.get(c.ownerId) ?? { ownerId: c.ownerId, ownerName: c.ownerName, total: 0, items: [] };
		g.items.push(c);
		if (!c.removed && c.priceCents) g.total += c.priceCents;
		groups.set(c.ownerId, g);
	}
	const all = [...groups.values()];
	return { groups: all, grandTotal: all.reduce((s, g) => s + g.total, 0), count: claims.filter((c) => !c.removed).length };
};
