<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '$lib/components/Icon.svelte';
	let { data, form } = $props();
	let showPw = $state(false);
</script>

<svelte:head><title>Me · Wishbook</title></svelte:head>

<header class="hdr">
	<h1>{data.me.displayName}</h1>
	<p class="meta">Signed in as {data.me.username}</p>
</header>

<main class="pg">
	{#if data.me.isAdmin}
		<div class="secthd"><b>Admin</b></div>
		<a class="row" href="/admin/users">People and kids<Icon name="chev" size={20} /></a>
		<a class="row" href="/admin/import">Import from Elfster<Icon name="chev" size={20} /></a>
		<a class="row" href="/admin/prices">Prices<Icon name="chev" size={20} /></a>
	{/if}

	<div class="secthd sp"><b>Past Christmases</b></div>
	{#each data.seasons as s (s.season)}
		<a class="row" href="/me/archive/{s.season}">Christmas {s.season}<span class="cnt">{s.count} {s.count === 1 ? 'gift' : 'gifts'}<Icon name="chev" size={20} /></span></a>
	{:else}
		<p class="muted">Nothing yet.</p>
	{/each}

	<div class="secthd sp"><b>Password</b></div>
	{#if form?.pwDone}<p class="note">Password changed. Other phones will need to sign in again.</p>{/if}
	{#if !showPw}
		<button class="btn ghost" onclick={() => (showPw = true)}>Change my password</button>
	{:else}
		<form method="POST" action="?/password" use:enhance>
			<label class="lbl" for="cur">Current password</label>
			<input class="field" id="cur" name="current" type="password" autocomplete="current-password" required />
			<label class="lbl" for="nw">New password</label>
			<input class="field" id="nw" name="next" type="password" autocomplete="new-password" minlength="8" required />
			<label class="lbl" for="cf">New password again</label>
			<input class="field" id="cf" name="confirm" type="password" autocomplete="new-password" minlength="8" required />
			{#if form?.pwMessage}<p class="err" role="alert">{form.pwMessage}</p>{/if}
			<button class="btn ink" style="margin-top:16px">Save new password</button>
		</form>
	{/if}

	<form method="POST" action="/logout" class="sp"><button class="btn danger">Sign out</button></form>
</main>

<style>
	.sp { margin-top: 28px; }
	.row { display: flex; justify-content: space-between; align-items: center; min-height: 56px; border-bottom: 1px solid var(--rule); font-weight: 700; font-size: 17px; color: var(--ink); text-decoration: none; }
	.cnt { display: flex; align-items: center; gap: 6px; color: var(--muted); font-weight: 400; font-size: 15px; }
	.muted { color: var(--muted); }
</style>
