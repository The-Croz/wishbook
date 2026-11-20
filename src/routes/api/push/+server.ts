import { error, json } from '@sveltejs/kit';
import { removeSubscription, saveSubscription } from '$lib/server/notify';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Sign in first');
	try {
		saveSubscription(locals.user.id, await request.json());
	} catch {
		error(400, 'That subscription didn’t look right');
	}
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Sign in first');
	const { endpoint } = (await request.json().catch(() => ({}))) as { endpoint?: string };
	if (endpoint) removeSubscription(locals.user.id, endpoint);
	return json({ ok: true });
};
