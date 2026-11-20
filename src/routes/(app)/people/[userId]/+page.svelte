<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import GiftGrid from '$lib/components/GiftGrid.svelte';
	import SortMenu from '$lib/components/SortMenu.svelte';
	import ArrangeList from '$lib/components/ArrangeList.svelte';
	import { defaultSort, sortGifts, type SortMode } from '$lib/sortGifts';
	let { data } = $props();
	let filter = $state<'all' | 'open' | 'under50'>('all');
	// Follows the list's default until the viewer picks another order.
	const customOrder = $derived(data.customOrder);
	let sort = $derived<SortMode>(defaultSort(customOrder));
	let arranging = $state(false);
	const shown = $derived(
		sortGifts(data.items, sort).filter((i) => filter === 'all' || (filter === 'open' ? !i.claim : i.priceCents != null && i.priceCents < 5000))
	);
	const claimed = $derived(data.items.filter((i) => i.claim).length);
	const name = $derived(data.owner.displayName);
</script>

<svelte:head><title>{name} · Wishbook</title></svelte:head>

<header class="hdr">
	<a class="back" href="/"><Icon name="back" size={20} />Family</a>
	<h1>{name}{data.owner.isManaged ? '’s list' : ''}</h1>
	<p class="meta">{data.items.length} {data.items.length === 1 ? 'want' : 'wants'}{#if data.showClaims}{` · ${claimed} claimed · ${data.items.length - claimed} still open`}{/if}</p>
	{#if data.canEdit}<a class="btn ink hbtn" href="/add?for={data.owner.id}"><Icon name="plus" size={20} />Add for {name}</a>{/if}
</header>

<main class="pg">
	{#if data.canEdit && data.owner.isManaged}
		<p class="note">You manage {name}’s list and shop for {name}, so you see claims here. {name} never logs in.</p>
	{/if}
	{#if arranging}
		<ArrangeList items={sortGifts(data.items, defaultSort(data.customOrder))} customOrder={data.customOrder} done={() => (arranging = false)} />
	{:else if data.items.length > 0}
		<div class="bar">
			<SortMenu bind:value={sort} customOrder={data.customOrder} />
			{#if data.canEdit && data.items.length > 1}<button class="arr" onclick={() => (arranging = true)}>Arrange {name}’s list</button>{/if}
		</div>
		<div class="chips" role="group" aria-label="Filter gifts">
			<button class:on={filter === 'all'} onclick={() => (filter = 'all')} aria-pressed={filter === 'all'}>All</button>
			<button class:on={filter === 'open'} onclick={() => (filter = 'open')} aria-pressed={filter === 'open'}>Still open</button>
			<button class:on={filter === 'under50'} onclick={() => (filter = 'under50')} aria-pressed={filter === 'under50'}>Under $50</button>
		</div>
		<GiftGrid items={shown} />
		{#if shown.length === 0}<div class="empty"><b>Nothing here</b>Try another filter.</div>{/if}
	{:else}
		<div class="empty"><b>No gifts yet</b>{data.canEdit ? `Add the first gift for ${name}.` : `${name} hasn’t added anything yet.`}</div>
	{/if}
</main>

{#if data.canEdit}<a class="fab mob" href="/add?for={data.owner.id}"><Icon name="plus" size={20} />Add for {name}</a>{/if}

<style>
	.bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
	.arr { min-height: 40px; padding: 0 14px; border-radius: 99px; border: 2px solid var(--ink); font-weight: 700; font-size: 14px; background: #fff; color: var(--ink); }
	.back { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; font-size: 16px; color: var(--on-hdr); text-decoration: none; min-height: 44px; }
	.chips { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
	.chips button { min-height: 40px; padding: 0 14px; border-radius: 99px; border: 2px solid var(--ink); font-weight: 700; font-size: 14px; background: #fff; }
	.chips button.on { background: var(--ink); color: #fff; }
	.fab { position: fixed; right: max(16px, calc(50% - 304px)); bottom: calc(var(--tabbar) + 16px + env(safe-area-inset-bottom)); z-index: 15; height: 56px; padding: 0 22px 0 18px; border-radius: 28px; background: var(--ink); color: #fff; font-weight: 700; font-size: 17px; display: flex; align-items: center; gap: 8px; box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25); text-decoration: none; }
</style>
