import { error, fail, redirect } from '@sveltejs/kit';
import { getListForViewer } from '$lib/server/lists';
import { budgetForUser, setLimit } from '$lib/server/budget';
import { currentSeason } from '$lib/season';
import { parseCents } from '$lib/money';
import { listOrderActions } from '$lib/server/listActions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, params }) => {
	const id = Number(params.userId);
	if (!Number.isInteger(id)) error(404, 'Person not found');
	if (id === locals.user!.id) redirect(303, '/me/list');
	return { ...getListForViewer(locals.user!, id), budget: budgetForUser(locals.user!, id, currentSeason(new Date())) };
};

const ownerOf = (params: Record<string, string>) => {
	const id = Number(params.userId);
	if (!Number.isInteger(id)) error(404, 'Person not found');
	return id;
};

export const actions = {
	...listOrderActions((_me, _url, params) => ownerOf(params)),
	/** The budget strip at the top of someone's page. */
	budget: async ({ locals, request, params }: { locals: App.Locals; request: Request; params: Record<string, string> }) => {
		const cents = parseCents(String((await request.formData()).get('cents') ?? ''));
		if (cents === undefined) return fail(400, { message: 'That budget doesn’t look like an amount' });
		setLimit(locals.user!, currentSeason(new Date()), `u:${ownerOf(params)}`, cents);
	}
};
