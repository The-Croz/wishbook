import { error } from '@sveltejs/kit';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { avatarDir, PHOTO_NAME } from '$lib/server/profile';
import type { RequestHandler } from './$types';

const TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;

/** Signed-in only (the route guard checks). Names change on every upload, so they cache forever. */
export const GET: RequestHandler = ({ params }) => {
	if (!PHOTO_NAME.test(params.file)) error(404, 'Not found');
	let body: Buffer;
	try {
		body = readFileSync(join(avatarDir(), params.file));
	} catch {
		error(404, 'Not found');
	}
	const ext = params.file.split('.').pop() as keyof typeof TYPES;
	return new Response(new Uint8Array(body), {
		headers: { 'content-type': TYPES[ext], 'cache-control': 'private, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' }
	});
};
