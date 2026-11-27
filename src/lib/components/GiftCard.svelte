<script lang="ts">
	import type { ItemView } from '$lib/types';
	import { formatMoney } from '$lib/money';
	import GiftArt from './GiftArt.svelte';
	import MarkerLoop from './MarkerLoop.svelte';
	import Check from './Check.svelte';
	import { claimedCount, isFullyClaimed, myClaim } from '$lib/claimCount';
	let { item, n }: { item: ItemView; n: number } = $props();
	const claimed = $derived(isFullyClaimed(item));
	const taken = $derived(claimedCount(item));
	const mine = $derived(myClaim(item));
	const label = $derived.by(() => {
		const cl = item.claims ?? [];
		if (!taken) return '';
		if (item.quantity === 1 && cl.length === 1) return cl[0].isMine ? 'You have it' : `${cl[0].claimerName} has it`;
		if (mine) return claimed && cl.length === 1 ? 'You have them all' : `You’re getting ${mine.quantity}`;
		return claimed ? 'All claimed' : `${taken} of ${item.quantity} claimed`;
	});
</script>

<a class="it" class:claimed href="/items/{item.id}">
	<GiftArt src={item.imageUrl} store={item.store} title={item.title} />
	<div class="no">NO. {String(n).padStart(2, '0')}{item.store ? ` · ${item.store.toUpperCase()}` : ''}</div>
	<div class="t">{item.title}</div>
	{#if item.priceCents != null}
		<div class="pr num">{formatMoney(item.priceCents, item.currency)}{#if item.priceSignal?.kind !== 'usual' && item.listPriceCents && item.listPriceCents > item.priceCents}<s>{formatMoney(item.listPriceCents, item.currency)}</s>{/if}</div>
		{#if item.priceSignal?.kind === 'deal'}<div class="deal">Real deal · {item.priceSignal.pctOff}% below usual</div>
		{:else if item.priceSignal?.kind === 'drop'}<div class="deal">Price drop · {item.priceSignal.pctOff}% off</div>
		{:else if item.priceSignal?.kind === 'usual'}<div class="usual">Its usual price</div>{/if}
	{/if}
	{#if item.quantity > 1 && !taken}<div class="qty">Wants {item.quantity}</div>{/if}
	{#if label}<div class="hand" class:part={!claimed}>{label}</div>{/if}
	{#if claimed}<span class="chk"><Check /></span>{/if}
	{#if item.priority === 'most'}<MarkerLoop /><span class="sr-only">Most wanted.</span>{/if}
	{#if label}<span class="sr-only">{label}.</span>{/if}
</a>

<style>
	.it { position: relative; display: block; padding-bottom: 4px; color: var(--ink); text-decoration: none; min-width: 0; }
	.it:active { opacity: 0.85; }
	.no { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; color: var(--muted); margin-top: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.t { font-weight: 700; font-size: 15px; line-height: 1.2; margin-top: 2px; display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
	.pr { font-family: var(--display); font-size: 21px; color: var(--red); margin-top: 4px; }
	.pr s { color: var(--muted); font-family: var(--body); font-size: 13px; margin-left: 4px; }
	.hand { font-family: var(--hand); font-size: 22px; line-height: 1; color: var(--pine); margin-top: 4px; }
	.hand.part { color: var(--ink); }
	.deal { display: inline-block; font-size: 12px; font-weight: 700; letter-spacing: 0.02em; color: #fff; background: var(--pine); border-radius: 4px; padding: 2px 6px; margin-top: 4px; }
	.usual { font-size: 13px; font-weight: 700; color: var(--muted); margin-top: 2px; }
	.qty { font-size: 13px; font-weight: 700; color: var(--muted); margin-top: 4px; }
	.chk { position: absolute; top: 6px; right: 6px; }
	.claimed :global(.art) { opacity: 0.5; }
	@media (min-width: 900px) { .t { font-size: 16px; } .pr { font-size: 22px; } .hand { font-size: 24px; } .it:hover :global(.art) { outline: 3px solid var(--ink); outline-offset: 3px; } }
</style>
