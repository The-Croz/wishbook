<script lang="ts">
	import { onMount } from 'svelte';
	let { vapidKey }: { vapidKey: string } = $props();
	type State = 'checking' | 'unsupported' | 'ios-install' | 'blocked' | 'off' | 'on' | 'working';
	let status = $state<State>('checking');
	let error = $state('');

	const toKey = (b64: string) => {
		const pad = '='.repeat((4 - (b64.length % 4)) % 4);
		const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
		return Uint8Array.from(raw, (c) => c.charCodeAt(0));
	};

	onMount(async () => {
		const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
		const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone;
		if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
			status = ios && !standalone ? 'ios-install' : 'unsupported';
			return;
		}
		if (Notification.permission === 'denied') { status = 'blocked'; return; }
		const reg = await navigator.serviceWorker.ready;
		status = (await reg.pushManager.getSubscription()) ? 'on' : 'off';
	});

	async function turnOn() {
		error = '';
		status = 'working';
		try {
			if ((await Notification.requestPermission()) !== 'granted') { status = Notification.permission === 'denied' ? 'blocked' : 'off'; return; }
			const reg = await navigator.serviceWorker.ready;
			const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(vapidKey) });
			const res = await fetch('/api/push', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(sub) });
			if (!res.ok) throw new Error();
			status = 'on';
		} catch {
			error = 'Couldn’t turn on notifications. Try again.';
			status = 'off';
		}
	}

	async function turnOff() {
		status = 'working';
		const reg = await navigator.serviceWorker.ready;
		const sub = await reg.pushManager.getSubscription();
		if (sub) {
			await fetch('/api/push', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
			await sub.unsubscribe();
		}
		status = 'off';
	}
</script>

{#if status === 'on'}
	<p class="on">Notifications are on for this phone.</p>
	<button class="btn ghost" onclick={turnOff}>Turn off on this phone</button>
{:else if status === 'off' || status === 'working'}
	<button class="btn ink" onclick={turnOn} disabled={status === 'working'}>{status === 'working' ? 'Turning on…' : 'Turn on notifications'}</button>
{:else if status === 'ios-install'}
	<p class="note">On iPhone, notifications work once Wishbook is on your Home Screen: tap the Share button, then “Add to Home Screen”, then open Wishbook from there.</p>
{:else if status === 'blocked'}
	<p class="note">Notifications are blocked for Wishbook. Turn them on in your phone’s settings for this app, then come back.</p>
{:else if status === 'unsupported'}
	<p class="note">This browser can’t show notifications.</p>
{/if}
{#if error}<p class="err">{error}</p>{/if}

<style>
	.on { color: var(--pine); font-weight: 700; margin-bottom: 10px; }
</style>
