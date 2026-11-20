import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { eq } from 'drizzle-orm';
import { createTestDb, getDb } from '../../src/lib/server/db';
import { users } from '../../src/lib/server/db/schema';
import { avatarDir, clearAvatarPhoto, setAvatarColor, setAvatarPhoto } from '../../src/lib/server/profile';
import { makeManager, makeUser } from './helpers';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const fresh = (id: number) => getDb().select().from(users).where(eq(users.id, id)).get()!;

let dir: string;
beforeEach(() => {
	createTestDb();
	dir = mkdtempSync(join(tmpdir(), 'avatars-'));
	process.env.AVATAR_DIR = dir;
});
afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
	delete process.env.AVATAR_DIR;
});

describe('setAvatarColor', () => {
	it('saves one of the palette colors for yourself', () => {
		const kate = makeUser('kate');
		setAvatarColor(kate, kate.id, '#a9d3be');
		expect(fresh(kate.id).avatarColor).toBe('#A9D3BE');
	});
	it('rejects colors outside the palette', () => {
		const kate = makeUser('kate');
		expect(() => setAvatarColor(kate, kate.id, '#000000')).toThrow(expect.objectContaining({ status: 400 }));
	});
	it('stops changing someone else', () => {
		const kate = makeUser('kate'), june = makeUser('june');
		expect(() => setAvatarColor(kate, june.id, '#A9D3BE')).toThrow(expect.objectContaining({ status: 403 }));
	});
	it('lets the admin and a kid’s managers change it', () => {
		const admin = makeUser('josh', { isAdmin: true }), kate = makeUser('kate'), june = makeUser('june');
		const milo = makeUser('milo', { isManaged: true });
		makeManager(milo.id, kate.id);
		setAvatarColor(kate, milo.id, '#BFD0EE');
		setAvatarColor(admin, june.id, '#D9C7F0');
		expect(fresh(milo.id).avatarColor).toBe('#BFD0EE');
		expect(fresh(june.id).avatarColor).toBe('#D9C7F0');
		expect(() => setAvatarColor(june, milo.id, '#A9D3BE')).toThrow(expect.objectContaining({ status: 403 }));
	});
});

describe('setAvatarPhoto', () => {
	it('stores the photo and replaces the old one', () => {
		const kate = makeUser('kate');
		const first = setAvatarPhoto(kate, kate.id, JPEG);
		expect(first).toMatch(new RegExp(`^${kate.id}-[0-9a-f]{12}\\.jpg$`));
		expect(existsSync(join(avatarDir(), first))).toBe(true);
		const second = setAvatarPhoto(kate, kate.id, PNG);
		expect(second.endsWith('.png')).toBe(true);
		expect(existsSync(join(avatarDir(), first))).toBe(false);
		expect(fresh(kate.id).avatarPhoto).toBe(second);
	});
	it('refuses files that aren’t images', () => {
		const kate = makeUser('kate');
		expect(() => setAvatarPhoto(kate, kate.id, new TextEncoder().encode('<svg onload=alert(1)>'))).toThrow(expect.objectContaining({ status: 400 }));
	});
	it('refuses very large files', () => {
		const kate = makeUser('kate');
		const big = new Uint8Array(600 * 1024);
		big.set(JPEG);
		expect(() => setAvatarPhoto(kate, kate.id, big)).toThrow(expect.objectContaining({ status: 400 }));
	});
	it('removes the photo', () => {
		const kate = makeUser('kate');
		const name = setAvatarPhoto(kate, kate.id, JPEG);
		clearAvatarPhoto(kate, kate.id);
		expect(fresh(kate.id).avatarPhoto).toBeNull();
		expect(existsSync(join(avatarDir(), name))).toBe(false);
	});
});
