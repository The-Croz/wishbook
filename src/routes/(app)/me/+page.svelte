<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '$lib/components/Icon.svelte';
	import PushToggle from '$lib/components/PushToggle.svelte';
	import ProfilePicker from '$lib/components/ProfilePicker.svelte';
	let { data, form } = $props();
	let showPw = $state(false);
</script>

<svelte:head><title>Me · Wishbook</title></svelte:head>

<header class="hdr">
	<h1>{data.me.displayName}</h1>
	<p class="meta">Signed in as {data.me.username}</p>
</header>

<main class="pg">
	<div class="secthd"><b>Your picture</b></div>
	<ProfilePicker userId={data.me.id} name={data.me.displayName} color={data.me.avatarColor} photo={data.me.avatarPhoto} />

	{#if data.me.isAdmin}
		<div class="secthd sp"><b>Admin</b></div>
		<a class="row" href="/admin/users">People and kids<Icon name="chev" size={20} /></a>
		<a class="row" href="/admin/import">Import from Elfster<Icon name="chev" size={20} /></a>
		<a class="row" href="/admin/prices">Prices<Icon name="chev" size={20} /></a>
	{/if}

	<div class="secthd sp"><b>Your lists by year</b></div>
	{#each data.seasons as s (s.season)}
		<a class="row" href="/me/archive/{s.season}">Christmas {s.season}<span class="cnt">{s.count} {s.count === 1 ? 'gift' : 'gifts'}<Icon name="chev" size={20} /></span></a>
	{:else}
		<p class="muted">Nothing yet.</p>
	{/each}

	<div class="secthd sp"><b>Notifications</b></div>
	<PushToggle vapidKey={data.vapidKey} />
	<form method="POST" action="?/prefs" use:enhance class="prefs">
		<p class="lbl">Tell me when…</p>
		{#each [['newGifts', 'Someone adds gifts to their list'], ['claimChanged', 'A gift I’m buying is changed or removed'], ['priceDrop', 'A gift I’m buying drops in price'], ['reminders', 'Christmas reminders (Dec 1 and Dec 27)'], ['budget', 'Someone wants to share a budget with me']] as [k, label]}
			<label class="check"><input type="checkbox" name={k} checked={data.prefs[k as keyof typeof data.prefs]} onchange={(e) => e.currentTarget.form?.requestSubmit()} />{label}</label>
		{/each}
		<p class="hint">You’re never told anything about who’s getting gifts on your own list.</p>
	</form>

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
	.prefs { margin-top: 14px; }
	.check { display: flex; align-items: center; gap: 10px; min-height: 48px; font-size: 16px; }
	.check input { width: 22px; height: 22px; accent-color: var(--red); flex: none; }
	.hint { font-size: 14px; color: var(--muted); margin-top: 6px; }
</style>
