<script lang="ts">
	import { enhance } from '$app/forms';
	import Logo from '$lib/components/Logo.svelte';
	let { data, form } = $props();
	let busy = $state(false);
</script>

<svelte:head><title>Sign in · Wishbook</title></svelte:head>

<main class="login">
	<div class="mark"><Logo onRed width={280} /></div>
	<h1>Wishbook</h1>
	<form method="POST" use:enhance={() => { busy = true; return async ({ update }) => { await update(); busy = false; }; }}>
		<label class="lbl" for="username">Username</label>
		<input class="field" id="username" name="username" autocomplete="username" autocapitalize="none" required value={form?.username ?? ''} />
		<label class="lbl" for="password">Password</label>
		<input class="field" id="password" name="password" type="password" autocomplete="current-password" required />
		{#if form?.message}<p class="msg" role="alert">{form.message}</p>{/if}
		<button class="btn ink" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
	</form>
	<p class="help">Forgot it? Ask {data.adminName} to reset your password.</p>
</main>

<style>
	.login { max-width: 420px; margin: 0 auto; padding: calc(env(safe-area-inset-top) + 56px) 28px 40px; color: #fff; }
	.mark { display: flex; justify-content: center; }
	h1 { font-family: var(--display); font-weight: 400; font-size: 30px; text-align: center; margin: -4px 0 10px; }
	.lbl { color: #fff; }
	.field { border-color: #fff; }
	.btn { margin-top: 20px; }
	.msg { margin-top: 12px; background: #fff; color: var(--red); font-weight: 700; padding: 10px 12px; border-radius: 10px; }
	.help { margin-top: 18px; font-size: 15px; color: var(--pink); }
</style>
