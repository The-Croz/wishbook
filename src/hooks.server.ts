import { error, redirect, type Handle, type ServerInit } from '@sveltejs/kit';
import { routeGuard } from '$lib/server/guard';
import { SESSION_COOKIE, seedAdmin, validateSession } from '$lib/server/auth';
import { getDb } from '$lib/server/db';
import { startPriceScheduler } from '$lib/server/prices';

export const init: ServerInit = async () => {
	getDb();
	await seedAdmin(process.env.ADMIN_USERNAME, process.env.ADMIN_PASSWORD);
	startPriceScheduler();
};

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE);
	event.locals.user = token ? await validateSession(token) : null;
	if (token && !event.locals.user) event.cookies.delete(SESSION_COOKIE, { path: '/' });
	const verdict = routeGuard(event.url.pathname, event.locals.user);
	if (verdict === 'forbidden') error(403, 'Only the admin can do that');
	if (verdict === 'login') {
		if (event.request.method !== 'GET' || event.url.pathname.startsWith('/api/')) error(401, 'Sign in first');
		redirect(303, `/login?next=${encodeURIComponent(event.url.pathname + event.url.search)}`);
	}
	return resolve(event);
};
