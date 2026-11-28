import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb, getDb } from '../../src/lib/server/db';
import { items, pushSubscriptions } from '../../src/lib/server/db/schema';
import {
	announceNewGifts, drainNotifications, getPrefs, getVapidKeys, removeSubscription, saveSubscription, sendReminders,
	setPrefs, setPushSender, type SentPush
} from '../../src/lib/server/notify';
import { claimItem } from '../../src/lib/server/claims';
import { createItem, deleteItem, updateItem } from '../../src/lib/server/lists';
import { refreshItem } from '../../src/lib/server/prices';
import { acceptInvite, invitePartner, stopSharing } from '../../src/lib/server/budget';
import { makeManager, makeUser } from './helpers';

const fx = (n: string) => readFileSync(new URL(`../fixtures/${n}`, import.meta.url), 'utf8');
const page = (html: string) => (async (url: string) => ({ ok: true, status: 200, url, text: async () => html }) as unknown as Response) as unknown as typeof fetch;
const MIN = 60_000;

let sent: SentPush[];
let josh: ReturnType<typeof makeUser>, kate: ReturnType<typeof makeUser>, june: ReturnType<typeof makeUser>, milo: ReturnType<typeof makeUser>;
const sub = (u: { id: number }, n = 1) => saveSubscription(u.id, { endpoint: `https://push.example/${u.id}/${n}`, keys: { p256dh: 'p', auth: 'a' } });
const to = (u: { id: number }) => sent.filter((s) => s.userId === u.id);

beforeEach(() => {
	createTestDb();
	sent = [];
	setPushSender(async (s) => { sent.push(s); return 201; });
	josh = makeUser('josh'); kate = makeUser('kate'); june = makeUser('june', { displayName: 'Grandma June' }); milo = makeUser('milo', { isManaged: true });
	makeManager(milo.id, josh.id);
	for (const u of [josh, kate, june]) sub(u);
});

describe('keys and subscriptions', () => {
	it('creates VAPID keys once and keeps them', () => {
		const a = getVapidKeys();
		expect(getVapidKeys()).toEqual(a);
		expect(a.publicKey.length).toBeGreaterThan(40);
	});
	it('saves a phone once per endpoint and can remove it', () => {
		sub(kate);
		expect(getDb().select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, kate.id)).all()).toHaveLength(1);
		removeSubscription(kate.id, `https://push.example/${kate.id}/1`);
		expect(getDb().select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, kate.id)).all()).toHaveLength(0);
	});
	it('drops a phone the push service says is gone', async () => {
		setPushSender(async () => 410);
		createItem(kate, kate.id, { title: 'Mug' }, 2026);
		announceNewGifts(new Date(Date.now() + 11 * MIN));
		await drainNotifications();
		expect(getDb().select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, josh.id)).all()).toHaveLength(0);
	});
});

describe('new gifts', () => {
	it('waits 10 minutes, then sends one bundled note to everyone but the owner', async () => {
		createItem(kate, kate.id, { title: 'Mug' }, 2026);
		createItem(kate, kate.id, { title: 'Scarf' }, 2026);
		announceNewGifts(new Date(Date.now() + 5 * MIN));
		await drainNotifications();
		expect(sent).toHaveLength(0);
		announceNewGifts(new Date(Date.now() + 11 * MIN));
		await drainNotifications();
		expect(to(kate)).toHaveLength(0);
		expect(to(josh)).toHaveLength(1);
		expect(to(josh)[0].payload).toMatchObject({ title: 'Kate added 2 gifts', url: `/people/${kate.id}` });
		announceNewGifts(new Date(Date.now() + 30 * MIN));
		await drainNotifications();
		expect(to(josh)).toHaveLength(1);
	});
	it('does not tell the parent who added gifts to a kid list', async () => {
		createItem(josh, milo.id, { title: 'Bike' }, 2026);
		announceNewGifts(new Date(Date.now() + 11 * MIN));
		await drainNotifications();
		expect(to(josh)).toHaveLength(0);
		expect(to(kate)[0].payload.title).toBe('Milo’s list has 1 new gift');
	});
	it('respects a turned-off preference', async () => {
		setPrefs(june.id, { newGifts: false });
		createItem(kate, kate.id, { title: 'Mug' }, 2026);
		announceNewGifts(new Date(Date.now() + 11 * MIN));
		await drainNotifications();
		expect(to(june)).toHaveLength(0);
		expect(getPrefs(june.id)).toMatchObject({ newGifts: false, claimChanged: true, priceDrop: true, reminders: true, budget: true });
	});
});

describe('claimed gift changed or removed', () => {
	it('tells only the claimer when the owner changes it', async () => {
		const i = createItem(june, june.id, { title: 'Sony headphones' }, 2026);
		claimItem(kate, i.id);
		updateItem(june, i.id, { title: 'Bose headphones' });
		await drainNotifications();
		expect(to(kate)[0].payload).toMatchObject({ title: 'Grandma June changed a gift you’re getting', url: `/items/${i.id}` });
		expect(to(june)).toHaveLength(0);
		expect(to(josh)).toHaveLength(0);
	});
	it('tells everyone splitting a gift when it changes', async () => {
		const i = createItem(june, june.id, { title: 'Wine glasses', quantity: 4 }, 2026);
		claimItem(kate, i.id, 2);
		claimItem(josh, i.id, 2);
		updateItem(june, i.id, { title: 'Champagne flutes' });
		await drainNotifications();
		expect(to(kate)).toHaveLength(1);
		expect(to(josh)).toHaveLength(1);
		expect(to(june)).toHaveLength(0);
	});
	it('tells the claimer when it is removed', async () => {
		const i = createItem(june, june.id, { title: 'Mug' }, 2026);
		claimItem(kate, i.id);
		deleteItem(june, i.id);
		await drainNotifications();
		expect(to(kate)[0].payload.title).toBe('Grandma June removed a gift you’re getting');
	});
	it('says nothing when nobody claimed it, or only the priority changed', async () => {
		const a = createItem(june, june.id, { title: 'Mug' }, 2026);
		updateItem(june, a.id, { title: 'Big mug' });
		const b = createItem(june, june.id, { title: 'Hat' }, 2026);
		claimItem(kate, b.id);
		updateItem(june, b.id, { priority: 'most' });
		await drainNotifications();
		expect(sent).toHaveLength(0);
	});
});

describe('price drops', () => {
	it('tells the claimer when the nightly check finds a lower price', async () => {
		const i = createItem(june, june.id, { title: 'Kindle', url: 'https://www.amazon.com/dp/B0D7HXJ8QK', priceCents: 18999 }, 2026);
		claimItem(kate, i.id);
		await refreshItem(i.id, page(fx('amazon-product.html')));
		await drainNotifications();
		expect(to(kate)[0].payload).toMatchObject({ title: 'Price drop: $149.99', body: expect.stringContaining('was $189.99') });
		expect(to(june)).toHaveLength(0);
	});
	it('stays quiet when the price goes up or nobody claimed it', async () => {
		const up = createItem(june, june.id, { title: 'K', url: 'https://www.amazon.com/dp/B0D7HXJ8QK', priceCents: 9999 }, 2026);
		claimItem(kate, up.id);
		await refreshItem(up.id, page(fx('amazon-product.html')));
		const free = createItem(june, june.id, { title: 'K2', url: 'https://www.amazon.com/dp/B0D7HXJ8QK', priceCents: 18999 }, 2026);
		await refreshItem(free.id, page(fx('amazon-product.html')));
		await drainNotifications();
		expect(sent).toHaveLength(0);
	});
});

describe('reminders', () => {
	it('on Dec 1 nudges adults with an empty list', async () => {
		createItem(kate, kate.id, { title: 'Mug' }, 2026);
		sendReminders(new Date(2026, 11, 1, 10));
		await drainNotifications();
		expect(to(kate)).toHaveLength(0);
		expect(to(josh)[0].payload.title).toBe('Your wishlist is empty');
	});
	it('on Dec 27 asks everyone with gifts to mark what they received, without hinting at claims', async () => {
		createItem(kate, kate.id, { title: 'Mug' }, 2026);
		sendReminders(new Date(2026, 11, 27, 10));
		await drainNotifications();
		expect(to(kate)[0].payload.title).toBe('What did you get?');
		expect(to(josh)).toHaveLength(0);
	});
	it('stays quiet on other days and when turned off', async () => {
		sendReminders(new Date(2026, 11, 2, 10));
		setPrefs(josh.id, { reminders: false });
		sendReminders(new Date(2026, 11, 1, 10));
		await drainNotifications();
		expect(to(josh)).toHaveLength(0);
	});
});

describe('carried-over and imported gifts', () => {
	it('are not announced as new', async () => {
		createItem(kate, kate.id, { title: 'Mug' }, 2026);
		getDb().update(items).set({ announcedAt: new Date() }).run();
		announceNewGifts(new Date(Date.now() + 11 * MIN));
		await drainNotifications();
		expect(sent).toHaveLength(0);
	});
});

import { POST as subscribe, DELETE as unsubscribe } from '../../src/routes/api/push/+server';
describe('push API', () => {
	const req = (method: string, body: unknown) => new Request('http://x/api/push', { method, body: JSON.stringify(body) });
	it('requires sign-in', async () => {
		await expect(subscribe({ request: req('POST', {}), locals: { user: null } } as never)).rejects.toMatchObject({ status: 401 });
	});
	it('saves and removes this phone for the signed-in person', async () => {
		const body = { endpoint: 'https://push.example/new', keys: { p256dh: 'p', auth: 'a' } };
		expect((await subscribe({ request: req('POST', body), locals: { user: kate } } as never)).status).toBe(200);
		expect(getDb().select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, body.endpoint)).get()?.userId).toBe(kate.id);
		await unsubscribe({ request: req('DELETE', { endpoint: body.endpoint }), locals: { user: kate } } as never);
		expect(getDb().select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, body.endpoint)).get()).toBeUndefined();
	});
	it('rejects a bad subscription', async () => {
		await expect(subscribe({ request: req('POST', { endpoint: 'http://insecure', keys: {} }), locals: { user: kate } } as never)).rejects.toMatchObject({ status: 400 });
	});
});

describe('budget sharing', () => {
	it('tells only the person invited, then the inviter when they accept', async () => {
		invitePartner(josh, kate.id);
		await drainNotifications();
		expect(sent.map((s) => [s.userId, s.payload.title])).toEqual([[kate.id, 'Josh wants to share a budget with you']]);
		expect(to(kate)[0].payload.url).toBe('/budget');
		sent = [];
		acceptInvite(kate, josh.id);
		await drainNotifications();
		expect(sent.map((s) => [s.userId, s.payload.title])).toEqual([[josh.id, 'Kate is sharing a budget with you now']]);
	});
	it('doesn’t repeat an invite already sent', async () => {
		invitePartner(josh, kate.id);
		invitePartner(josh, kate.id);
		await drainNotifications();
		expect(to(kate)).toHaveLength(1);
	});
	it('tells the partner when someone stops sharing', async () => {
		invitePartner(josh, kate.id);
		acceptInvite(kate, josh.id);
		await drainNotifications();
		sent = [];
		stopSharing(josh);
		await drainNotifications();
		expect(sent.map((s) => [s.userId, s.payload.title])).toEqual([[kate.id, 'Josh stopped sharing your budget']]);
	});
	it('respects the budget setting', async () => {
		setPrefs(kate.id, { budget: false });
		invitePartner(josh, kate.id);
		await drainNotifications();
		expect(to(kate)).toHaveLength(0);
	});
});
