<script lang="ts">
	import { onMount } from 'svelte';
	import { currentSubscription, disablePush, enablePush, isIos, isStandalone, pushSupported } from '$lib/push';
	let { vapidKey }: { vapidKey: string } = $props();
	type State = 'checking' | 'unsupported' | 'ios-install' | 'blocked' | 'off' | 'on' | 'working';
	let status = $state<State>('checking');
	let error = $state('');

	onMount(async () => {
		if (!pushSupported()) {
			status = isIos() && !isStandalone() ? 'ios-install' : 'unsupported';
			return;
		}
		if (Notification.permission === 'denied') { status = 'blocked'; return; }
		status = (await currentSubscription()) ? 'on' : 'off';
	});

	async function turnOn() {
		error = '';
		status = 'working';
		try {
			status = await enablePush(vapidKey);
		} catch {
			error = 'Couldn’t turn on notifications. Try again.';
			status = 'off';
		}
	}

	async function turnOff() {
		status = 'working';
		await disablePush();
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
