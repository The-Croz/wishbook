<script lang="ts">
	import GiftArt from '$lib/components/GiftArt.svelte';
	import { formatMoney } from '$lib/money';
	let { data } = $props();
</script>

<svelte:head><title>I'm buying · Wishbook</title></svelte:head>

<header class="hdr">
	<h1>I’m buying</h1>
	<p class="meta">{data.count} {data.count === 1 ? 'gift' : 'gifts'}{data.grandTotal ? ` · ${formatMoney(data.grandTotal, 'USD')} so far` : ''}</p>
</header>

<main class="pg">
	{#if data.groups.length === 0}
		<div class="empty"><b>Nothing claimed yet</b>Open someone’s list and tap “I’ll get this” on a gift.</div>
	{/if}
	{#each data.groups as g (g.ownerId)}
		<section>
			<div class="secthd"><b>For {g.ownerName}</b><span class="num">{g.total ? formatMoney(g.total, 'USD') : ''}</span></div>
			{#each g.items as c (c.id)}
				<a class="row" class:removed={c.removed} href="/items/{c.id}">
					<span class="thumb"><GiftArt src={c.imageUrl} store={c.store} title={c.title} height={64} /></span>
					<span class="body">
						<span class="t">{#if c.mine.quantity > 1}<span class="x num">{c.mine.quantity}×</span> {/if}{c.title}</span>
						<span class="sm">
							{#if c.removed}<span class="badge">Removed from the list</span>{:else if c.changed}<span class="badge chg">Changed since you claimed it</span>{:else if c.mine.purchased}<span class="bought">Bought</span>{:else}Not bought yet{/if}
						</span>
					</span>
					<span class="store">{c.store ?? ''}</span>
					{#if c.priceCents != null}<span class="pr num">{formatMoney(c.priceCents * c.mine.quantity, c.currency)}</span>{/if}
				</a>
			{/each}
		</section>
	{/each}
</main>

<style>
	section + section { margin-top: 26px; }
	.row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--rule); color: var(--ink); text-decoration: none; min-height: 64px; }
	.thumb { width: 64px; flex: none; }
	.body { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
	.t { font-weight: 700; font-size: 15px; line-height: 1.2; }
	.x { color: var(--red); }
	.sm { font-size: 14px; color: var(--muted); }
	.bought { color: var(--pine); font-weight: 700; }
	.badge { background: var(--pink); color: var(--red-deep); font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
	.badge.chg { background: #fff7d6; color: var(--ink); }
	.store { display: none; }
	@media (min-width: 900px) {
		.row { display: grid; grid-template-columns: 72px minmax(0, 1fr) 140px 110px; gap: 18px; padding: 12px 8px; }
		.row:hover { background: var(--wash); }
		.thumb { width: 72px; }
		.store { display: block; color: var(--muted); font-size: 15px; }
		.t { font-size: 16px; }
		.pr { text-align: right; font-size: 19px; }
	}
	.removed .t { text-decoration: line-through; color: var(--muted); }
	.pr { font-family: var(--display); color: var(--red); font-size: 17px; flex: none; }
</style>
