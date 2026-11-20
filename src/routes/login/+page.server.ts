import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { authenticate, checkLoginRate, clearLoginRate, createSession, SESSION_COOKIE } from '$lib/server/auth';
import { getDb } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

import { safeNext } from '$lib/server/guard';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeNext(url.searchParams.get('next'), url.origin));
	const admin = getDb().select({ name: users.displayName }).from(users).where(eq(users.isAdmin, true)).limit(1).get();
	return { adminName: admin?.name ?? 'your admin' };
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress, url }) => {
		const form = await request.formData();
		const username = String(form.get('username') ?? '').trim();
		const password = String(form.get('password') ?? '');
		const key = `${username.toLowerCase()}|${getClientAddress()}`;
		if (!checkLoginRate(key)) return fail(429, { username, message: 'Too many tries. Wait 15 minutes and try again.' });
		const user = await authenticate(username, password);
		if (!user) return fail(400, { username, message: "That username and password don't match." });
		clearLoginRate(key);
		const { token, expiresAt } = await createSession(user.id);
		cookies.set(SESSION_COOKIE, token, { path: '/', httpOnly: true, secure: url.protocol === 'https:', sameSite: 'lax', expires: expiresAt });
		redirect(303, safeNext(url.searchParams.get('next'), url.origin));
	}
};
