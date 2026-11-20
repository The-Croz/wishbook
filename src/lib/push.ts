/** Browser-side helpers shared by the Me page toggle and the first-run prompts. */

const toKey = (b64: string) => {
	const pad = '='.repeat((4 - (b64.length % 4)) % 4);
	const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
	return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || Boolean((navigator as { standalone?: boolean }).standalone);

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** Set when someone turns notifications off on purpose, so we stop offering them. */
const OPTED_OUT = 'wb-push-off';

export function storeGet(key: string): string | null {
	try { return localStorage.getItem(key); } catch { return null; }
}
export function storeSet(key: string, value: string | null) {
	try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* private mode */ }
}
export const optedOut = () => storeGet(OPTED_OUT) === '1';

export async function currentSubscription(): Promise<PushSubscription | null> {
	const reg = await navigator.serviceWorker.ready;
	return reg.pushManager.getSubscription();
}

/** Asks permission (must run from a tap), subscribes, and tells the server. Returns the resulting state. */
export async function enablePush(vapidKey: string): Promise<'on' | 'blocked' | 'off'> {
	if ((await Notification.requestPermission()) !== 'granted') return Notification.permission === 'denied' ? 'blocked' : 'off';
	const reg = await navigator.serviceWorker.ready;
	const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(vapidKey) });
	const res = await fetch('/api/push', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(sub) });
	if (!res.ok) throw new Error('subscribe failed');
	storeSet(OPTED_OUT, null);
	return 'on';
}

export async function disablePush() {
	const sub = await currentSubscription();
	if (sub) {
		await fetch('/api/push', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
		await sub.unsubscribe();
	}
	storeSet(OPTED_OUT, '1');
}
