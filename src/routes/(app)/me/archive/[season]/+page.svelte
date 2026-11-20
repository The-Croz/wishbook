<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import GiftGrid from '$lib/components/GiftGrid.svelte';
	let { data } = $props();
	const received = $derived(data.items.filter((i) => i.status === 'received'));
	const rest = $derived(data.items.filter((i) => i.status !== 'received'));
</script>

<svelte:head><title>Christmas {data.season} · Wishbook</title></svelte:head>

<header class="hdr">
	<a class="back" href="/me"><Icon name="back" size={20} />Me</a>
	<h1>Christmas {data.season}</h1>
	<p class="meta">{received.length} received</p>
</header>
<main class="pg">
	{#if received.length}<div class="secthd"><b>Received</b></div><GiftGrid items={received} />{/if}
	{#if rest.length}<div class="secthd" style="margin-top:28px"><b>Still on the list</b></div><GiftGrid items={rest} />{/if}
	{#if !data.items.length}<div class="empty"><b>Nothing here</b>No gifts were on your list that year.</div>{/if}
</main>

<style>
	.back { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; color: var(--on-hdr); text-decoration: none; min-height: 44px; }
</style>
