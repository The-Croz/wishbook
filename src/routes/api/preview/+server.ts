import { error, json } from '@sveltejs/kit';
import { scrape } from '$lib/server/scrape';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Sign in first');
	const { text } = (await request.json().catch(() => ({}))) as { text?: string };
	if (!text || text.length > 2000) error(400, 'Paste a link');
	return json(await scrape(text));
};
