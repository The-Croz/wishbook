import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { getDb } from './db';
import { users, type User } from './db/schema';
import { getManagerIds } from './lists';
import { AVATAR_COLORS } from '../avatar';

export const MAX_PHOTO_BYTES = 512 * 1024;
export const PHOTO_NAME = /^\d+-[0-9a-f]{12}\.(jpg|png|webp)$/;

/** Photos live beside the database so they ride along in the same /data volume. */
export function avatarDir(): string {
	return process.env.AVATAR_DIR ?? join(dirname(resolve(process.env.DATABASE_PATH ?? '/data/wishbook.db')), 'avatars');
}

/** You, the admin, or a parent who manages a kid's list. Returns the person being changed. */
function editable(viewer: User, userId: number): User {
	const target = getDb().select().from(users).where(eq(users.id, userId)).get();
	if (!target) error(404, 'Person not found');
	const ok = viewer.id === target.id || viewer.isAdmin || (target.isManaged && getManagerIds(target.id).includes(viewer.id));
	if (!ok) error(403, 'You can’t change that picture');
	return target;
}

export function setAvatarColor(viewer: User, userId: number, color: string) {
	editable(viewer, userId);
	const c = color.toUpperCase();
	if (!(AVATAR_COLORS as readonly string[]).includes(c)) error(400, 'Pick one of the colors');
	getDb().update(users).set({ avatarColor: c }).where(eq(users.id, userId)).run();
}

function sniff(b: Uint8Array): 'jpg' | 'png' | 'webp' | null {
	if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
	if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
	if (String.fromCharCode(...b.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...b.subarray(8, 12)) === 'WEBP') return 'webp';
	return null;
}

function removeFile(name: string | null) {
	if (name && PHOTO_NAME.test(name)) rmSync(join(avatarDir(), name), { force: true });
}

export function setAvatarPhoto(viewer: User, userId: number, bytes: Uint8Array): string {
	const target = editable(viewer, userId);
	if (bytes.length === 0) error(400, 'Pick a photo');
	if (bytes.length > MAX_PHOTO_BYTES) error(400, 'That photo is too big');
	const ext = sniff(bytes);
	if (!ext) error(400, 'Use a JPEG, PNG, or WebP photo');
	const name = `${target.id}-${randomBytes(6).toString('hex')}.${ext}`;
	mkdirSync(avatarDir(), { recursive: true });
	writeFileSync(join(avatarDir(), name), bytes);
	getDb().update(users).set({ avatarPhoto: name }).where(eq(users.id, target.id)).run();
	removeFile(target.avatarPhoto);
	return name;
}

export function clearAvatarPhoto(viewer: User, userId: number) {
	const target = editable(viewer, userId);
	getDb().update(users).set({ avatarPhoto: null }).where(eq(users.id, target.id)).run();
	removeFile(target.avatarPhoto);
}
