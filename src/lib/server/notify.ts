/**
 * Web push. Every message goes to a specific person for a reason that is theirs to know:
 * a list owner is never told anything about claims on their own list.
 */
import * as webpush from 'web-push';
import { and, eq, inArray, isNull, lte, ne } from 'drizzle-orm';
import cron from 'node-cron';
import { getDb } from './db';
import { appSettings, claims, items, lists, notifyPrefs, pushSubscriptions, users } from './db/schema';
import { formatMoney } from '$lib/money';
import { currentSeason } from '$lib/season';

export type PrefKey = 'newGifts' | 'claimChanged' | 'priceDrop' | 'reminders' | 'budget';
export type Prefs = Record<PrefKey, boolean>;
export type Payload = { title: string; body?: string; url: string; tag?: string };
export type SentPush = { userId: number; endpoint: string; payload: Payload };
type Sender = (s: SentPush & { p256dh: string; auth: string }) => Promise<number>;

const ANNOUNCE_DELAY_MS = 10 * 60_000;

export function getVapidKeys(): { publicKey: string; privateKey: string } {
	const db = getDb();
	const row = db.select().from(appSettings).where(eq(appSettings.key, 'vapid')).get();
	if (row) return JSON.parse(row.value);
	const keys = webpush.generateVAPIDKeys();
	db.insert(appSettings).values({ key: 'vapid', value: JSON.stringify(keys) }).onConflictDoNothing().run();
	return JSON.parse(db.select().from(appSettings).where(eq(appSettings.key, 'vapid')).get()!.value);
}

const webPushSender: Sender = async (s) => {
	const keys = getVapidKeys();
	try {
		const r = await webpush.sendNotification(
			{ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
			JSON.stringify(s.payload),
			{ vapidDetails: { subject: process.env.ORIGIN ?? 'mailto:admin@localhost', ...keys }, TTL: 60 * 60 * 24 }
		);
		return r.statusCode;
	} catch (e) {
		return (e as { statusCode?: number }).statusCode ?? 500;
	}
};

let sender: Sender = webPushSender;
const pending = new Set<Promise<unknown>>();

/** Tests swap the network sender for a recorder. */
export function setPushSender(fn: Sender) {
	sender = fn;
}

/** Waits for notifications already queued (tests; graceful shutdown). */
export async function drainNotifications() {
	while (pending.size) await Promise.all([...pending]);
}

export function saveSubscription(userId: number, sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
	if (!/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) throw new Error('Bad subscription');
	getDb().insert(pushSubscriptions).values({ userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth })
		.onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth } }).run();
}

export function removeSubscription(userId: number, endpoint: string) {
	getDb().delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint))).run();
}

export function getPrefs(userId: number): Prefs {
	const row = getDb().select().from(notifyPrefs).where(eq(notifyPrefs.userId, userId)).get();
	return { newGifts: row?.newGifts ?? true, claimChanged: row?.claimChanged ?? true, priceDrop: row?.priceDrop ?? true, reminders: row?.reminders ?? true, budget: row?.budget ?? true };
}

export function setPrefs(userId: number, patch: Partial<Prefs>) {
	const next = { ...getPrefs(userId), ...patch };
	getDb().insert(notifyPrefs).values({ userId, ...next }).onConflictDoUpdate({ target: notifyPrefs.userId, set: next }).run();
}

/** Queues a push to each person who has that type turned on. Fire-and-forget; never throws. */
export function notify(userIds: number[], type: PrefKey, payload: Payload) {
	const db = getDb();
	const ids = [...new Set(userIds)].filter((id) => getPrefs(id)[type]);
	if (!ids.length) return;
	for (const s of db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, ids)).all()) {
		const p = sender({ userId: s.userId, endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth, payload })
			.then((status) => {
				if (status === 404 || status === 410) db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id)).run();
			})
			.catch(() => {})
			.finally(() => pending.delete(p));
		pending.add(p);
	}
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** Bundles gifts added more than 10 minutes ago into one note per list, sent to everyone but the owner and whoever added them. */
export function announceNewGifts(now = new Date()) {
	const db = getDb();
	const rows = db.select({ id: items.id, createdBy: items.createdBy, ownerId: lists.ownerId, name: users.displayName, isManaged: users.isManaged })
		.from(items).innerJoin(lists, eq(lists.id, items.listId)).innerJoin(users, eq(users.id, lists.ownerId))
		.where(and(isNull(items.announcedAt), isNull(items.deletedAt), lte(items.createdAt, new Date(now.getTime() - ANNOUNCE_DELAY_MS)))).all();
	if (!rows.length) return;
	db.update(items).set({ announcedAt: now }).where(inArray(items.id, rows.map((r) => r.id))).run();
	const everyone = db.select({ id: users.id }).from(users).where(and(eq(users.isActive, true), eq(users.isManaged, false))).all().map((u) => u.id);
	const byOwner = Map.groupBy(rows, (r) => r.ownerId);
	for (const [ownerId, group] of byOwner) {
		const { name, isManaged } = group[0];
		const adders = new Set(group.map((g) => g.createdBy));
		const title = isManaged ? `${name}’s list has ${plural(group.length, 'new gift')}` : `${name} added ${plural(group.length, 'gift')}`;
		notify(everyone.filter((id) => id !== ownerId && !adders.has(id)), 'newGifts', { title, body: 'Take a look before someone else claims them.', url: `/people/${ownerId}`, tag: `new-${ownerId}` });
	}
}

/** Everyone buying some of a gift, plus whose list it's on. */
function claimersOf(itemId: number) {
	const rows = getDb().select({ claimerId: claims.claimerId, ownerId: lists.ownerId, ownerName: users.displayName, title: items.title })
		.from(claims).innerJoin(items, eq(items.id, claims.itemId)).innerJoin(lists, eq(lists.id, items.listId))
		.innerJoin(users, eq(users.id, lists.ownerId)).where(eq(claims.itemId, itemId)).all();
	if (!rows.length) return null;
	const { ownerId, ownerName, title } = rows[0];
	return { ownerId, ownerName, title, claimerIds: rows.map((r) => r.claimerId).filter((id) => id !== ownerId) };
}

/** The owner (or a parent) changed or removed a gift people have claimed: tell those people. */
export function notifyClaimChanged(itemId: number, kind: 'changed' | 'removed', actorId: number) {
	const c = claimersOf(itemId);
	const to = c?.claimerIds.filter((id) => id !== actorId) ?? [];
	if (!c || !to.length) return;
	notify(to, 'claimChanged', {
		title: `${c.ownerName} ${kind} a gift you’re getting`,
		body: kind === 'removed' ? `“${c.title}” was taken off the list. Check before buying.` : `Now: “${c.title}”. Check the details before buying.`,
		url: `/items/${itemId}`
	});
}

/** Budget sharing news, sent only to the one person it's about. */
export function notifyBudgetShare(toId: number, kind: 'invite' | 'accepted' | 'stopped', fromName: string) {
	const text = {
		invite: { title: `${fromName} wants to share a budget with you`, body: 'You’d both see one Christmas plan. Gifts for each other stay hidden.' },
		accepted: { title: `${fromName} is sharing a budget with you now`, body: 'Your Christmas plan is combined. Gifts for each other stay hidden.' },
		stopped: { title: `${fromName} stopped sharing your budget`, body: 'You each keep a copy of the plan.' }
	}[kind];
	notify([toId], 'budget', { ...text, url: '/budget', tag: `budget-${kind}` });
}

export function notifyPriceDrop(itemId: number, oldCents: number, newCents: number, currency: string) {
	const c = claimersOf(itemId);
	if (!c || !c.claimerIds.length || newCents >= oldCents) return;
	notify(c.claimerIds, 'priceDrop', {
		title: `Price drop: ${formatMoney(newCents, currency)}`,
		body: `${c.title} (was ${formatMoney(oldCents, currency)}), for ${c.ownerName}.`,
		url: `/items/${itemId}`
	});
}

/** Dec 1: nudge adults with an empty list. Dec 27: ask everyone with gifts to mark what they got (sent to all, so it reveals nothing). */
export function sendReminders(now = new Date()) {
	const m = now.getMonth(), d = now.getDate();
	if (m !== 11 || (d !== 1 && d !== 27)) return;
	const db = getDb();
	const season = currentSeason(now);
	const adults = db.select({ id: users.id }).from(users).where(and(eq(users.isActive, true), eq(users.isManaged, false))).all().map((u) => u.id);
	const counts = new Map<number, number>();
	for (const r of db.select({ ownerId: lists.ownerId, id: items.id }).from(items).innerJoin(lists, eq(lists.id, items.listId))
		.where(and(eq(lists.season, season), isNull(items.deletedAt), ne(items.status, 'received'))).all()) counts.set(r.ownerId, (counts.get(r.ownerId) ?? 0) + 1);
	if (d === 1) notify(adults.filter((id) => !counts.get(id)), 'reminders', { title: 'Your wishlist is empty', body: 'Add a few ideas so the family knows what to get you.', url: '/add' });
	else notify(adults.filter((id) => counts.get(id)), 'reminders', { title: 'What did you get?', body: 'Mark your gifts received so they don’t carry over to next year.', url: '/me/list' });
}

let started = false;
export function startNotificationJobs() {
	if (started) return;
	started = true;
	cron.schedule('*/5 * * * *', () => { try { announceNewGifts(); } catch (e) { console.error('[wishbook] announce failed', e); } });
	cron.schedule('0 10 * * *', () => { try { sendReminders(); } catch (e) { console.error('[wishbook] reminders failed', e); } });
}
