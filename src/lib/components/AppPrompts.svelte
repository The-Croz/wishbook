<script lang="ts">
	import { onMount } from 'svelte';
	import { currentSubscription, enablePush, isIos, isStandalone, optedOut, pushSupported, storeGet, storeSet } from '$lib/push';
	import { choosePrompt, type Prompt } from '$lib/prompts';

	let { vapidKey }: { vapidKey: string } = $props();

	let prompt = $state<Prompt | 'android-install'>('none');
	let working = $state(false);
	let error = $state('');
	let installEvent: (Event & { prompt: () => Promise<void> }) | null = null;

	const SNOOZE_DAYS = 3;
	const snoozed = (key: string) => {
		const at = Number(storeGet(key));
		return at > 0 && Date.now() - at < SNOOZE_DAYS * 86_400_000;
	};

	onMount(() => {
		const standalone = isStandalone();
		const supported = pushSupported();
		const env = {
			standalone, ios: isIos(), pushSupported: supported,
			permission: supported ? Notification.permission : ('default' as NotificationPermission),
			subscribed: false, optedOut: optedOut(), installSnoozed: snoozed('wb-install-snooze'), notifySnoozed: snoozed('wb-notify-snooze')
		};
		if (!standalone) {
			prompt = choosePrompt(env);
			// Android and desktop Chrome hand us a real install button; use it.
			if (env.installSnoozed) return;
			const onPrompt = (e: Event) => {
				e.preventDefault();
				installEvent = e as typeof installEvent;
				if (prompt === 'none') prompt = 'android-install';
			};
			window.addEventListener('beforeinstallprompt', onPrompt);
			return () => window.removeEventListener('beforeinstallprompt', onPrompt);
		}
		(async () => {
			if (supported) env.subscribed = Boolean(await currentSubscription());
			prompt = choosePrompt(env);
		})();
	});

	function later() {
		storeSet(prompt === 'notify' ? 'wb-notify-snooze' : 'wb-install-snooze', String(Date.now()));
		prompt = 'none';
	}

	async function turnOn() {
		error = '';
		working = true;
		try {
			const state = await enablePush(vapidKey);
			if (state === 'on' || state === 'blocked') prompt = 'none';
			else later();
		} catch {
			error = 'Couldn’t turn on notifications. You can try again from the Me tab.';
		} finally {
			working = false;
		}
	}

	async function install() {
		await installEvent?.prompt();
		installEvent = null;
		prompt = 'none';
	}
</script>

{#if prompt !== 'none'}
	<div class="sheet" role="dialog" aria-labelledby="prompt-title">
		{#if prompt === 'ios-install'}
			<h2 id="prompt-title">Put Wishbook on your Home Screen</h2>
			<p class="why">You get a real app, and notifications when gifts are added.</p>
			<ol>
				<li>Tap the <b>•••</b> button in Safari’s bar</li>
				<li>Tap <b>Share</b></li>
				<li>Scroll down and tap <b>Add to Home Screen</b></li>
			</ol>
			<p class="why">Then open Wishbook from your Home Screen.</p>
			<button class="btn ghost" onclick={later}>Maybe later</button>
		{:else if prompt === 'android-install'}
			<h2 id="prompt-title">Install Wishbook</h2>
			<p class="why">Add it to your phone like any other app.</p>
			<button class="btn ink" onclick={install}>Install</button>
			<button class="btn ghost" onclick={later}>Maybe later</button>
		{:else}
			<h2 id="prompt-title">Want a heads-up on gifts?</h2>
			<p class="why">We’ll tell you when someone adds gifts, or when something you’re getting changes. Nobody is ever told what you’ve claimed.</p>
			{#if error}<p class="err">{error}</p>{/if}
			<button class="btn ink" onclick={turnOn} disabled={working}>{working ? 'Turning on…' : 'Turn on notifications'}</button>
			<button class="btn ghost" onclick={later}>Not now</button>
		{/if}
	</div>
{/if}

<style>
	.sheet { position: fixed; z-index: 30; left: 12px; right: 12px; bottom: calc(var(--tabbar) + env(safe-area-inset-bottom) + 8px); max-width: 616px; margin: 0 auto; background: #fff; color: var(--ink); border: 2px solid var(--ink); border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.28); }
	@media (min-width: 900px) { .sheet { left: auto; right: 24px; bottom: 24px; width: 380px; margin: 0; } }
	h2 { font-family: var(--display); font-weight: 400; font-size: 21px; line-height: 1.1; }
	.why { font-size: 15px; color: var(--muted); }
	ol { padding-left: 22px; display: flex; flex-direction: column; gap: 6px; font-size: 16px; }
	.btn { min-height: 48px; font-size: 16px; }
</style>
