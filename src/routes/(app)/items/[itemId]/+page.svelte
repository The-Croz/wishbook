<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '$lib/components/Icon.svelte';
	import GiftArt from '$lib/components/GiftArt.svelte';
	import { formatMoney } from '$lib/money';
	import { timeAgo } from '$lib/time';
	let { data, form } = $props();
	const item = $derived(data.item);
	const backHref = $derived(data.owner.id === data.me.id ? '/me/list' : `/people/${data.owner.id}`);
	const backLabel = $derived(data.owner.id === data.me.id ? 'My list' : data.owner.displayName);
	let confirmDelete = $state(false);
	const PRI = [['nice', 'Nice to have'], ['want', 'Want'], ['most', 'Most wanted']] as const;
</script>

<svelte:head><title>{item.title} · Wishbook</title></svelte:head>

<div class="detail">
	<div class="hero">
		<GiftArt src={item.imageUrl} store={item.store} title={item.title} height={300} />
		<a class="back" href={backHref}><Icon name="back" size={20} />{backLabel}</a>
	</div>
	<main class="dt">
		<p class="no">{item.store ? item.store.toUpperCase() : 'GIFT'}{item.priority === 'most' ? ' · MOST WANTED' : ''}</p>
		<h1>{item.title}</h1>
		{#if item.priceCents != null}
			<p class="pr num">{formatMoney(item.priceCents, item.currency)}{#if item.listPriceCents && item.listPriceCents > item.priceCents}<s>{formatMoney(item.listPriceCents, item.currency)}</s>{/if}</p>
		{/if}
		{#if item.deleted}<p class="note">This gift was removed from the list.</p>{/if}
		{#if item.notes}<div class="kv"><span>{data.owner.id === data.me.id ? 'Your note' : 'Note'}</span><span>{item.notes}</span></div>{/if}
		{#if item.priceCents != null}
			<div class="kv"><span>Price</span><span class="when"><Icon name="clock" size={16} />{item.priceCheckedAt ? `checked ${timeAgo(item.priceCheckedAt)}` : 'entered by hand'}</span></div>
		{/if}

		{#if data.showClaims && !item.deleted}
			{#if !item.claim}
				<form method="POST" action="?/claim" use:enhance><button class="btn pine">I’ll get this</button></form>
				<p class="hint">Everyone except {data.owner.displayName} will see that you’re getting it.</p>
			{:else if item.claim.isMine}
				<div class="mine">
					<p class="hand">You’re getting this</p>
					<form method="POST" action="?/purchased" use:enhance class="bought">
						<label><input type="checkbox" name="purchased" checked={item.claim.purchased} onchange={(e) => e.currentTarget.form?.requestSubmit()} /> Bought it</label>
					</form>
					<form method="POST" action="?/unclaim" use:enhance><button class="link">I’m not getting this anymore</button></form>
				</div>
			{:else}
				<p class="taken"><span class="hand">{item.claim.claimerName} has it</span> Pick something else so nobody doubles up.</p>
			{/if}
		{/if}
		{#if item.deleted && item.claim?.isMine}<p class="note">You claimed this before it was removed. Check with {data.owner.displayName} before buying.</p>{/if}

		{#if item.url}<a class="btn ghost" href={item.url} target="_blank" rel="noopener noreferrer">Open on {item.store ?? 'the store site'}<Icon name="ext" size={18} /></a>{/if}

		{#if data.canEdit && !item.deleted}
			<section class="edit" aria-label="Edit this gift">
				<form method="POST" action="?/priority" use:enhance class="seg" role="group" aria-label="How much is it wanted">
					{#each PRI as [v, l]}<button name="priority" value={v} class:on={item.priority === v} aria-pressed={item.priority === v}>{l}</button>{/each}
				</form>
				<a class="btn ghost" href="/add?edit={item.id}"><Icon name="edit" size={18} />Edit details</a>
				{#if !confirmDelete}
					<button class="btn danger" onclick={() => (confirmDelete = true)}><Icon name="trash" size={18} />Remove gift</button>
				{:else}
					<form method="POST" action="?/delete" class="confirm">
						<p>Remove this gift from the list?</p>
						<div><button type="button" class="btn ghost" onclick={() => (confirmDelete = false)}>Keep it</button><button class="btn">Remove</button></div>
					</form>
				{/if}
			</section>
		{/if}
		{#if form?.message}<p class="err" role="alert">{form.message}</p>{/if}
	</main>
</div>

<style>
	.detail { max-width: 640px; margin: 0 auto; background: #fff; min-height: 100dvh; padding-bottom: calc(var(--tabbar) + 40px); }
	.hero { position: relative; padding-top: env(safe-area-inset-top); background: var(--wash); }
	.back { position: absolute; top: calc(env(safe-area-inset-top) + 12px); left: 14px; display: inline-flex; align-items: center; gap: 4px; background: #fff; color: var(--ink); text-decoration: none; font-weight: 700; padding: 8px 14px 8px 8px; border-radius: 22px; min-height: 44px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12); }
	.dt { padding: 18px 20px 0; display: flex; flex-direction: column; gap: 10px; }
	.no { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; color: var(--muted); }
	h1 { font-family: var(--display); font-weight: 400; font-size: 26px; line-height: 1.08; letter-spacing: -0.01em; }
	.pr { font-family: var(--display); font-size: 32px; color: var(--red); }
	.pr s { color: var(--muted); font-family: var(--body); font-size: 15px; margin-left: 8px; }
	.kv { display: flex; justify-content: space-between; gap: 16px; padding: 10px 0; border-bottom: 1px solid var(--rule); font-size: 15px; }
	.kv span:first-child { color: var(--muted); flex: none; }
	.kv span:last-child { text-align: right; }
	.when { display: inline-flex; align-items: center; gap: 6px; }
	.edit { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; padding-top: 16px; border-top: 3px solid var(--ink); }
	.seg { display: flex; border: 2px solid var(--ink); border-radius: 10px; overflow: hidden; }
	.seg button { flex: 1; border: 0; background: #fff; padding: 12px 4px; font-weight: 700; font-size: 14px; min-height: 48px; }
	.seg button.on { background: var(--ink); color: #fff; }
	.hint { font-size: 14px; color: var(--muted); margin-top: -2px; }
	.hand { font-family: var(--hand); font-size: 26px; color: var(--pine); line-height: 1; }
	.mine { border: 2px dashed var(--pine); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
	.bought label { display: flex; align-items: center; gap: 10px; font-weight: 700; min-height: 44px; }
	.bought input { width: 24px; height: 24px; accent-color: var(--pine); }
	.link { background: none; border: 0; padding: 0; color: var(--red); font-weight: 700; text-decoration: underline; text-underline-offset: 3px; min-height: 44px; }
	.taken { background: var(--wash); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 4px; }
	.confirm { background: var(--wash); border-radius: 12px; padding: 14px; }
	.confirm p { font-weight: 700; margin-bottom: 10px; }
	.confirm div { display: flex; gap: 10px; }
</style>
