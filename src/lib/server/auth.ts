import { hash, verify } from '@node-rs/argon2';
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from './db';
import { loginAttempts, sessions, users, type User } from './db/schema';

const DAY = 24 * 60 * 60 * 1000;
const SESSION_DAYS = 30;
const RENEW_BELOW_DAYS = 15;
const RATE_MAX = 10;
const RATE_WINDOW = 15 * 60 * 1000;

export const SESSION_COOKIE = 'wishbook_session';

export function hashPassword(pw: string): Promise<string> {
	return hash(pw);
}

export async function verifyPassword(stored: string, pw: string): Promise<boolean> {
	try {
		return await verify(stored, pw);
	} catch {
		return false;
	}
}

const sha = (t: string) => createHash('sha256').update(t).digest('hex');

export async function createSession(userId: number): Promise<{ token: string; expiresAt: Date }> {
	const token = randomBytes(32).toString('base64url');
	const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY);
	getDb().insert(sessions).values({ id: sha(token), userId, expiresAt }).run();
	return { token, expiresAt };
}

/** Returns the session's user, extending the session when it is past half its life. */
export async function validateSession(token: string): Promise<User | null> {
	const db = getDb();
	const id = sha(token);
	const row = db.select().from(sessions).innerJoin(users, eq(users.id, sessions.userId)).where(eq(sessions.id, id)).get();
	if (!row) return null;
	if (row.sessions.expiresAt.getTime() <= Date.now() || !row.users.isActive || row.users.isManaged) {
		db.delete(sessions).where(eq(sessions.id, id)).run();
		return null;
	}
	if (row.sessions.expiresAt.getTime() - Date.now() < RENEW_BELOW_DAYS * DAY) {
		db.update(sessions).set({ expiresAt: new Date(Date.now() + SESSION_DAYS * DAY) }).where(eq(sessions.id, id)).run();
	}
	return row.users;
}

export function deleteSession(token: string) {
	getDb().delete(sessions).where(eq(sessions.id, sha(token))).run();
}

export function invalidateUserSessions(userId: number) {
	getDb().delete(sessions).where(eq(sessions.userId, userId)).run();
}

export async function authenticate(username: string, password: string): Promise<User | null> {
	const u = getDb().select().from(users).where(eq(users.username, username.trim().toLowerCase())).get();
	if (!u || !u.passwordHash || u.isManaged || !u.isActive) return null;
	return (await verifyPassword(u.passwordHash, password)) ? u : null;
}

/** True when another login attempt is allowed for this key (username|ip). Counts the attempt. */
export function checkLoginRate(key: string): boolean {
	const db = getDb();
	const now = Date.now();
	const row = db.select().from(loginAttempts).where(eq(loginAttempts.key, key)).get();
	if (!row || now - row.windowStart.getTime() > RATE_WINDOW) {
		db.insert(loginAttempts).values({ key, count: 1, windowStart: new Date(now) })
			.onConflictDoUpdate({ target: loginAttempts.key, set: { count: 1, windowStart: new Date(now) } }).run();
		return true;
	}
	if (row.count >= RATE_MAX) return false;
	db.update(loginAttempts).set({ count: sql`${loginAttempts.count} + 1` }).where(and(eq(loginAttempts.key, key))).run();
	return true;
}

export function clearLoginRate(key: string) {
	getDb().delete(loginAttempts).where(eq(loginAttempts.key, key)).run();
}

/** Creates the first admin from env when the users table is empty. */
export async function seedAdmin(username?: string, password?: string) {
	if (!username || !password) return;
	const db = getDb();
	const any = db.select({ id: users.id }).from(users).limit(1).get();
	if (any) return;
	const name = username.trim();
	db.insert(users).values({
		username: name.toLowerCase(),
		displayName: name[0].toUpperCase() + name.slice(1),
		passwordHash: await hashPassword(password),
		isAdmin: true,
		avatarColor: '#F2B705'
	}).run();
}

export const MIN_PASSWORD = 8;

/** Returns an error message, or null on success. Signs out every session for the user. */
export async function changePassword(userId: number, current: string, next: string): Promise<string | null> {
	const u = getDb().select().from(users).where(eq(users.id, userId)).get();
	if (!u?.passwordHash || !(await verifyPassword(u.passwordHash, current))) return "Your current password isn't right.";
	if (next.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
	getDb().update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, userId)).run();
	invalidateUserSessions(userId);
	return null;
}
