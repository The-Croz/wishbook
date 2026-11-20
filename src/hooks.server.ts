import type { Handle, ServerInit } from '@sveltejs/kit';
import { SESSION_COOKIE, seedAdmin, validateSession } from '$lib/server/auth';
import { getDb } from '$lib/server/db';

export const init: ServerInit = async () => {
	getDb();
	await seedAdmin(process.env.ADMIN_USERNAME, process.env.ADMIN_PASSWORD);
};

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE);
	event.locals.user = token ? await validateSession(token) : null;
	if (token && !event.locals.user) event.cookies.delete(SESSION_COOKIE, { path: '/' });
	return resolve(event);
};
