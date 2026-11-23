import { error, fail, redirect } from '@sveltejs/kit';
import { deleteItem, getItemForViewer, markReceived, setPriority, type Priority } from '$lib/server/lists';
import { showReceived } from '$lib/season';
import { claimItem, setPurchased, unclaimItem } from '$lib/server/claims';
import { repullItem } from '$lib/server/prices';
import type { Actions, PageServerLoad } from './$types';

const idOf = (p: string) => {
	const id = Number(p);
	if (!Number.isInteger(id)) error(404, 'Gift not found');
	return id;
};

export const load: PageServerLoad = ({ locals, params }) => ({ ...getItemForViewer(locals.user!, idOf(params.itemId)), receivedTime: showReceived(new Date()) });

export const actions: Actions = {
	claim: async ({ locals, params, request }) => {
		const raw = (await request.formData()).get('quantity');
		const r = claimItem(locals.user!, idOf(params.itemId), raw == null || raw === '' ? 1 : Number(raw));
		if (r.ok) return { claimed: true };
		const message =
			r.reason === 'taken'
				? r.left === 0
					? r.byName ? `${r.byName} already has this one.` : 'Someone just took the rest of these.'
					: `Only ${r.left} left now. Someone else claimed some.`
				: r.reason === 'removed' ? 'This gift was removed from the list.'
				: r.reason === 'bad-quantity' ? 'Pick how many you’re buying.'
				: 'You can’t claim gifts on your own list.';
		return fail(409, { message });
	},
	unclaim: ({ locals, params }) => {
		unclaimItem(locals.user!, idOf(params.itemId));
	},
	purchased: async ({ locals, params, request }) => {
		setPurchased(locals.user!, idOf(params.itemId), (await request.formData()).get('purchased') === 'on');
	},
	priority: async ({ locals, params, request }) => {
		const p = String((await request.formData()).get('priority')) as Priority;
		if (!['nice', 'want', 'most'].includes(p)) return fail(400, { message: 'Pick a priority' });
		setPriority(locals.user!, idOf(params.itemId), p);
	},
	received: async ({ locals, params, request }) => {
		markReceived(locals.user!, idOf(params.itemId), (await request.formData()).get('received') === 'yes');
	},
	refresh: async ({ locals, params }) => {
		const status = await repullItem(locals.user!, idOf(params.itemId));
		if (status === 'ok') return { refreshed: true };
		return fail(422, { message: status === 'blocked' ? 'That store wouldn’t let us read the page. Edit the details by hand instead.' : 'Couldn’t read that link right now. Try again in a bit.' });
	},
	delete: ({ locals, params }) => {
		const id = idOf(params.itemId);
		const { owner } = getItemForViewer(locals.user!, id);
		deleteItem(locals.user!, id);
		redirect(303, owner.id === locals.user!.id ? '/me/list' : `/people/${owner.id}`);
	}
};
