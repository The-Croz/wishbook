<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '$lib/components/Icon.svelte';
	let { data, form } = $props();
	const c = $derived(data.counts);
	const total = $derived(Object.values(c).reduce((a, b) => a + b, 0));
</script>

<svelte:head><title>Prices · Wishbook</title></svelte:head>

<header class="hdr">
	<a class="back" href="/me"><Icon name="back" size={20} />Me</a>
	<h1>Prices</h1>
	<p class="meta">Checked every night at 3am{data.disabled ? ' (turned off on this server)' : ''}</p>
</header>
<main class="pg">
	<div class="secthd"><b>This Christmas</b><span>{total} gifts with links</span></div>
	<div class="kv"><span>Read fine</span><b class="num">{c.ok ?? 0}</b></div>
	<div class="kv"><span>Store blocked the check</span><b class="num">{c.blocked ?? 0}</b></div>
	<div class="kv"><span>Couldn’t read the page</span><b class="num">{c.failed ?? 0}</b></div>
	<div class="kv"><span>Not checked yet</span><b class="num">{c.manual ?? 0}</b></div>
	{#if (c.blocked ?? 0) > total / 2 && total > 4}<p class="note" style="margin-top:14px">Most checks are being blocked. Amazon sometimes blocks home servers; prices on those gifts will stay at their last known value.</p>{/if}
	<form method="POST" action="?/refresh" use:enhance style="margin-top:20px">
		<button class="btn ink" disabled={data.running}>{data.running ? 'Checking prices now…' : 'Check all prices now'}</button>
	</form>
	{#if form?.started}<p class="note" style="margin-top:12px">Started. It runs slowly on purpose so stores don’t block it; refresh this page in a few minutes.</p>{/if}
</main>

<style>
	.back { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; color: #fff; text-decoration: none; min-height: 44px; }
	.kv { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--rule); }
</style>
