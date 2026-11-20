import { error, fail, redirect } from '@sveltejs/kit';
import { deleteItem, getItemForViewer, markReceived, setPriority, type Priority } from '$lib/server/lists';
import { showReceived } from '$lib/season';
import { claimItem, setPurchased, unclaimItem } from '$lib/server/claims';
import type { Actions, PageServerLoad } from './$types';

const idOf = (p: string) => {
	const id = Number(p);
	if (!Number.isInteger(id)) error(404, 'Gift not found');
	return id;
};

export const load: PageServerLoad = ({ locals, params }) => ({ ...getItemForViewer(locals.user!, idOf(params.itemId)), receivedTime: showReceived(new Date()) });

export const actions: Actions = {
	claim: ({ locals, params }) => {
		const r = claimItem(locals.user!, idOf(params.itemId));
		if (r.ok) return { claimed: true };
		const message = r.reason === 'taken' ? `${r.byName} already has this one.` : r.reason === 'removed' ? 'This gift was removed from the list.' : 'You can’t claim gifts on your own list.';
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
	delete: ({ locals, params }) => {
		const id = idOf(params.itemId);
		const { owner } = getItemForViewer(locals.user!, id);
		deleteItem(locals.user!, id);
		redirect(303, owner.id === locals.user!.id ? '/me/list' : `/people/${owner.id}`);
	}
};
