<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import GiftGrid from '$lib/components/GiftGrid.svelte';
	let { data } = $props();
	const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
</script>

<svelte:head><title>My list · Wishbook</title></svelte:head>

<header class="hdr">
	<div class="top"><span class="wm"><img src="/brand/stack.svg" alt="" width="26" height="26" />Wishbook</span><a class="av" href="/me" style:background={data.me.avatarColor} aria-label="Me">{initials(data.me.displayName)}</a></div>
	<h1>My wishlist</h1>
	<p class="meta">{data.items.length} {data.items.length === 1 ? 'want' : 'wants'} · Christmas {data.season}</p>
</header>

<main class="pg">
	<p class="note"><Icon name="eye" size={20} /><span>Claims on your list are hidden from you, so the surprise stays a surprise.</span></p>
	{#if data.items.length}
		<GiftGrid items={data.items} />
	{:else}
		<div class="empty"><b>Your list is empty</b>Paste a link from Amazon or any store to add your first gift.</div>
	{/if}
</main>

<a class="fab" href="/add"><Icon name="plus" size={20} />Add a gift</a>

<style>
	.top { display: flex; justify-content: space-between; align-items: center; }
	.wm { font-family: var(--display); font-size: 20px; display: flex; align-items: center; gap: 8px; }
	.av { width: 40px; height: 40px; border-radius: 50%; color: var(--ink); font-weight: 700; display: flex; align-items: center; justify-content: center; font-size: 15px; text-decoration: none; }
	.note :global(svg) { flex: none; color: var(--muted); margin-top: 1px; }
	.fab { position: fixed; right: max(16px, calc(50% - 304px)); bottom: calc(var(--tabbar) + 16px + env(safe-area-inset-bottom)); z-index: 15; height: 56px; padding: 0 22px 0 18px; border-radius: 28px; background: var(--ink); color: #fff; font-weight: 700; font-size: 17px; display: flex; align-items: center; gap: 8px; box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25); text-decoration: none; }
</style>
