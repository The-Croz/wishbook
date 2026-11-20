import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { getDb } from './db';
import { managers, users, type User } from './db/schema';
import { hashPassword, invalidateUserSessions, MIN_PASSWORD } from './auth';
import { AVATAR_COLORS } from '../avatar';

const COLORS = AVATAR_COLORS;
const USERNAME = /^[a-z0-9._-]{2,32}$/;

export function requireAdmin(viewer: User) {
	if (!viewer.isAdmin) error(403, 'Only the admin can do that');
}

function nextColor(): string {
	const n = getDb().select({ id: users.id }).from(users).all().length;
	return COLORS[n % COLORS.length];
}

export function listPeople() {
	const db = getDb();
	const all = db.select().from(users).all().sort((a, b) => Number(a.isManaged) - Number(b.isManaged) || a.displayName.localeCompare(b.displayName));
	const links = db.select().from(managers).all();
	return all.map((u) => ({
		id: u.id, username: u.username, displayName: u.displayName, isAdmin: u.isAdmin, isManaged: u.isManaged, isActive: u.isActive,
		avatarColor: u.avatarColor, avatarPhoto: u.avatarPhoto, managerIds: links.filter((l) => l.kidId === u.id).map((l) => l.managerId)
	}));
}

/** Returns an error message, or null when created. */
export async function createUser(admin: User, input: { username: string; displayName: string; password: string; isAdmin: boolean }): Promise<string | null> {
	requireAdmin(admin);
	const username = input.username.trim().toLowerCase();
	const displayName = input.displayName.trim() || input.username.trim();
	if (!USERNAME.test(username)) return 'Usernames can use letters, numbers, dots, dashes, and underscores.';
	if (input.password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
	if (getDb().select().from(users).where(eq(users.username, username)).get()) return 'That username is taken.';
	getDb().insert(users).values({ username, displayName, passwordHash: await hashPassword(input.password), isAdmin: input.isAdmin, avatarColor: nextColor() }).run();
	return null;
}

export function createManagedKid(admin: User, input: { displayName: string; birthYear?: number | null; managerIds: number[] }): User {
	requireAdmin(admin);
	const displayName = input.displayName.trim();
	if (!displayName) error(400, 'Give the kid a name');
	if (input.managerIds.length === 0) error(400, 'Pick at least one parent to manage the list');
	const username = `kid-${displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${randomBytes(3).toString('hex')}`;
	return getDb().transaction((tx) => {
		const [kid] = tx.insert(users).values({ username, displayName, isManaged: true, passwordHash: null, birthYear: input.birthYear ?? null, avatarColor: nextColor() }).returning().all();
		for (const managerId of new Set(input.managerIds)) tx.insert(managers).values({ kidId: kid.id, managerId }).run();
		return kid;
	});
}

export function setManagers(admin: User, kidId: number, managerIds: number[]) {
	requireAdmin(admin);
	if (managerIds.length === 0) error(400, 'Pick at least one parent to manage the list');
	getDb().transaction((tx) => {
		tx.delete(managers).where(eq(managers.kidId, kidId)).run();
		for (const managerId of new Set(managerIds)) tx.insert(managers).values({ kidId, managerId }).run();
	});
}

export async function resetPassword(admin: User, userId: number, password: string): Promise<string | null> {
	requireAdmin(admin);
	if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
	getDb().update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, userId)).run();
	invalidateUserSessions(userId);
	return null;
}

export function deactivateUser(admin: User, userId: number, active = false) {
	requireAdmin(admin);
	if (userId === admin.id) error(400, 'You can’t turn off your own account');
	getDb().update(users).set({ isActive: active }).where(eq(users.id, userId)).run();
	if (!active) invalidateUserSessions(userId);
}
