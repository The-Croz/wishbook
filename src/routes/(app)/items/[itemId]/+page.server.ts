import { error, fail, redirect } from '@sveltejs/kit';
import { deleteItem, getItemForViewer, setPriority, type Priority } from '$lib/server/lists';
import type { Actions, PageServerLoad } from './$types';

const idOf = (p: string) => {
	const id = Number(p);
	if (!Number.isInteger(id)) error(404, 'Gift not found');
	return id;
};

export const load: PageServerLoad = ({ locals, params }) => getItemForViewer(locals.user!, idOf(params.itemId));

export const actions: Actions = {
	priority: async ({ locals, params, request }) => {
		const p = String((await request.formData()).get('priority')) as Priority;
		if (!['nice', 'want', 'most'].includes(p)) return fail(400, { message: 'Pick a priority' });
		setPriority(locals.user!, idOf(params.itemId), p);
	},
	delete: ({ locals, params }) => {
		const id = idOf(params.itemId);
		const { owner } = getItemForViewer(locals.user!, id);
		deleteItem(locals.user!, id);
		redirect(303, owner.id === locals.user!.id ? '/me/list' : `/people/${owner.id}`);
	}
};
