<script lang="ts">
	import { isFullyClaimed } from '$lib/claimCount';
	import Icon from '$lib/components/Icon.svelte';
	import GiftGrid from '$lib/components/GiftGrid.svelte';
	import SortMenu from '$lib/components/SortMenu.svelte';
	import ArrangeList from '$lib/components/ArrangeList.svelte';
	import ProfilePicker from '$lib/components/ProfilePicker.svelte';
	import { defaultSort, sortGifts, type SortMode } from '$lib/sortGifts';
	import { enhance } from '$app/forms';
	import { centsToInput, formatMoney } from '$lib/money';
	let { data } = $props();
	let filter = $state<'all' | 'open' | 'under50'>('all');
	// Follows the list's default until the viewer picks another order.
	const customOrder = $derived(data.customOrder);
	let sort = $derived<SortMode>(defaultSort(customOrder));
	let arranging = $state(false);
	let picking = $state(false);
	const shown = $derived(
		sortGifts(data.items, sort).filter((i) => filter === 'all' || (filter === 'open' ? !isFullyClaimed(i) : i.priceCents != null && i.priceCents < 5000))
	);
	const claimed = $derived(data.items.filter((i) => isFullyClaimed(i)).length);
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
	{#if data.budget}
		{@const b = data.budget}
		{@const over = b.limitCents != null && b.plannedCents > b.limitCents}
		<div class="budget">
			<form method="POST" action="?/budget" use:enhance={() => async ({ update }) => update({ reset: false })}>
				<label>
					<span class="cap">{b.shared ? 'Our' : 'Your'} budget for {name}</span>
					<span class="amt"><i>$</i><input class="num" name="cents" inputmode="decimal" autocomplete="off" value={centsToInput(b.limitCents)} placeholder="Set one" onchange={(e) => e.currentTarget.form?.requestSubmit()} /></span>
				</label>
			</form>
			<div class="bsum num" class:over>
				{#if b.giftCount}{b.giftCount} {b.giftCount === 1 ? 'gift' : 'gifts'} · {formatMoney(b.plannedCents, 'USD')} planned · {formatMoney(b.spentCents, 'USD')} spent{:else}Nothing planned for {name} yet{/if}
				{#if over}<b>{' · '}over by {formatMoney(b.plannedCents - b.limitCents!, 'USD')}</b>{:else if b.limitCents != null && b.giftCount}{' · '}{formatMoney(b.limitCents - b.plannedCents, 'USD')} left{/if}
			</div>
			{#if b.limitCents}
				<span class="meter" aria-hidden="true"><i class="plan" style:width="{Math.min(100, (b.plannedCents / b.limitCents) * 100)}%"></i><i class="spent" style:width="{Math.min(100, (b.spentCents / b.limitCents) * 100)}%"></i></span>
			{/if}
			<a class="see" href="/budget#person-{b.key.replace(':', '-')}">See in Budget<Icon name="chev" size={16} /></a>
		</div>
	{/if}
	{#if data.canEdit && data.owner.isManaged}
		<p class="note">You manage {name}’s list and shop for {name}, so you see claims here. {name} never logs in.</p>
		{#if picking}
			<div class="pick"><ProfilePicker userId={data.owner.id} {name} color={data.owner.avatarColor} photo={data.owner.avatarPhoto} /><button class="arr done" onclick={() => (picking = false)}>Done</button></div>
		{:else}
			<button class="arr pickbtn" onclick={() => (picking = true)}>Change {name}’s picture</button>
		{/if}
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
	.budget { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; grid-template-areas: 'form sum see' 'form meter see'; align-items: center; gap: 4px 18px; background: var(--wash); border-radius: 14px; padding: 12px 16px; margin-bottom: 16px; }
	.budget form { grid-area: form; }
	.budget label { display: flex; flex-direction: column; }
	.cap { font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
	.amt { display: flex; align-items: baseline; font-family: var(--display); font-size: 26px; }
	.amt i { font-style: normal; color: var(--muted); font-size: 20px; }
	.amt input { font: inherit; width: 130px; border: 0; border-bottom: 2px dashed #cfcbc3; background: transparent; min-height: 40px; padding: 0; }
	.amt input::placeholder { color: #a9a6a0; font-size: 20px; }
	.amt input:focus { outline: none; border-bottom: 2px solid var(--red); }
	.bsum { grid-area: sum; font-size: 14px; font-weight: 700; color: var(--muted); }
	.bsum.over b { color: var(--red); }
	.meter { grid-area: meter; position: relative; height: 8px; border-radius: 4px; background: #e4e1da; overflow: hidden; }
	.meter i { position: absolute; inset: 0 auto 0 0; border-radius: 4px; }
	.meter .plan { background: #f3b6c0; }
	.meter .spent { background: var(--red); }
	.see { grid-area: see; display: inline-flex; align-items: center; gap: 2px; font-weight: 700; color: var(--red); text-decoration: none; min-height: 44px; font-size: 15px; }
	@media (max-width: 599px) {
		.budget { grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: 'form see' 'sum sum' 'meter meter'; }
	}
	.pick { margin-bottom: 18px; }
	.pickbtn { margin-bottom: 14px; }
	.done { margin-top: 14px; }
	.bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
	.arr { min-height: 40px; padding: 0 14px; border-radius: 99px; border: 2px solid var(--ink); font-weight: 700; font-size: 14px; background: #fff; color: var(--ink); }
	.back { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; font-size: 16px; color: var(--on-hdr); text-decoration: none; min-height: 44px; }
	.chips { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
	.chips button { min-height: 40px; padding: 0 14px; border-radius: 99px; border: 2px solid var(--ink); font-weight: 700; font-size: 14px; background: #fff; }
	.chips button.on { background: var(--ink); color: #fff; }
	.fab { position: fixed; right: max(16px, calc(50% - 304px)); bottom: calc(var(--tabbar) + 16px + env(safe-area-inset-bottom)); z-index: 15; height: 56px; padding: 0 22px 0 18px; border-radius: 28px; background: var(--ink); color: #fff; font-weight: 700; font-size: 17px; display: flex; align-items: center; gap: 8px; box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25); text-decoration: none; }
</style>
