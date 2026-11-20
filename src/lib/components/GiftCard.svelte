<script lang="ts">
	import type { ItemView } from '$lib/types';
	import { formatMoney } from '$lib/money';
	import GiftArt from './GiftArt.svelte';
	import MarkerLoop from './MarkerLoop.svelte';
	import Check from './Check.svelte';
	let { item, n }: { item: ItemView; n: number } = $props();
	const claimed = $derived(!!item.claim);
	const label = $derived(item.claim ? (item.claim.isMine ? 'You have it' : `${item.claim.claimerName} has it`) : '');
</script>

<a class="it" class:claimed href="/items/{item.id}">
	<GiftArt src={item.imageUrl} store={item.store} title={item.title} />
	<div class="no">NO. {String(n).padStart(2, '0')}{item.store ? ` · ${item.store.toUpperCase()}` : ''}</div>
	<div class="t">{item.title}</div>
	{#if item.priceCents != null}
		<div class="pr num">{formatMoney(item.priceCents, item.currency)}{#if item.listPriceCents && item.listPriceCents > item.priceCents}<s>{formatMoney(item.listPriceCents, item.currency)}</s>{/if}</div>
	{/if}
	{#if claimed}<div class="hand">{label}</div><span class="chk"><Check /></span>{/if}
	{#if item.priority === 'most'}<MarkerLoop /><span class="sr-only">Most wanted.</span>{/if}
	{#if claimed}<span class="sr-only">{label}.</span>{/if}
</a>

<style>
	.it { position: relative; display: block; padding-bottom: 4px; color: var(--ink); text-decoration: none; min-width: 0; }
	.it:active { opacity: 0.85; }
	.no { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; color: var(--muted); margin-top: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.t { font-weight: 700; font-size: 15px; line-height: 1.2; margin-top: 2px; display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
	.pr { font-family: var(--display); font-size: 21px; color: var(--red); margin-top: 4px; }
	.pr s { color: var(--muted); font-family: var(--body); font-size: 13px; margin-left: 4px; }
	.hand { font-family: var(--hand); font-size: 22px; line-height: 1; color: var(--pine); margin-top: 4px; }
	.chk { position: absolute; top: 6px; right: 6px; }
	.claimed :global(.art) { opacity: 0.5; }
</style>
