import { fail } from '@sveltejs/kit';
import { changePassword, createSession, SESSION_COOKIE } from '$lib/server/auth';
import { getSeasons } from '$lib/server/lists';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => ({ seasons: getSeasons(locals.user!.id) });

export const actions: Actions = {
	password: async ({ locals, request, cookies, url }) => {
		const f = await request.formData();
		const current = String(f.get('current') ?? '');
		const next = String(f.get('next') ?? '');
		if (next !== String(f.get('confirm') ?? '')) return fail(400, { pwMessage: 'The new passwords don’t match.' });
		const problem = await changePassword(locals.user!.id, current, next);
		if (problem) return fail(400, { pwMessage: problem });
		const { token, expiresAt } = await createSession(locals.user!.id);
		cookies.set(SESSION_COOKIE, token, { path: '/', httpOnly: true, secure: url.protocol === 'https:', sameSite: 'lax', expires: expiresAt });
		return { pwDone: true };
	}
};
