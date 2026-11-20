<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from './Icon.svelte';
	import type { ItemView } from '$lib/types';

	let { items, customOrder, done }: { items: ItemView[]; customOrder: boolean; done: () => void } = $props();

	// svelte-ignore state_referenced_locally
	let order = $state(items.map((i) => ({ id: i.id, title: i.title, imageUrl: i.imageUrl, most: i.priority === 'most' })));
	let saving = $state(false);

	/** Most-wanted gifts stay above the rest, so a gift only moves within its own group. */
	function move(n: number, by: -1 | 1) {
		const to = n + by;
		if (to < 0 || to >= order.length || order[to].most !== order[n].most) return;
		[order[n], order[to]] = [order[to], order[n]];
	}
	const canMove = (n: number, by: -1 | 1) => order[n + by] !== undefined && order[n + by].most === order[n].most;

	const finish = () => {
		saving = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			saving = false;
			done();
		};
	};
</script>

<section class="arrange" aria-label="Arrange your list">
	<p class="hint">Use the arrows to put your gifts in the order you like. Everyone will see them this way. Most-wanted gifts always stay on top.</p>
	<ol>
		{#each order as g, n (g.id)}
			<li>
				{#if g.imageUrl}<img src={g.imageUrl} alt="" width="44" height="44" />{:else}<span class="ph"></span>{/if}
				<span class="t">{#if g.most}<b class="star" aria-label="Most wanted">★</b>{/if}{g.title}</span>
				<button type="button" onclick={() => move(n, -1)} disabled={!canMove(n, -1)} aria-label="Move {g.title} up"><Icon name="up" size={20} /></button>
				<button type="button" onclick={() => move(n, 1)} disabled={!canMove(n, 1)} aria-label="Move {g.title} down"><Icon name="down" size={20} /></button>
			</li>
		{/each}
	</ol>
	<div class="acts">
		<form method="POST" action="?/reorder" use:enhance={finish}>
			<input type="hidden" name="ids" value={order.map((g) => g.id).join(',')} />
			<button class="btn ink" disabled={saving}>Save order</button>
		</form>
		<button type="button" class="btn ghost" onclick={done} disabled={saving}>Cancel</button>
		{#if customOrder}
			<form method="POST" action="?/resetOrder" use:enhance={finish}>
				<button class="link" disabled={saving}>Go back to newest first</button>
			</form>
		{/if}
	</div>
</section>

<style>
	.hint { color: var(--muted); font-size: 15px; margin: 0 0 12px; }
	ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
	li { display: flex; align-items: center; gap: 10px; background: #fff; border: 2px solid var(--line, #e5e0d8); border-radius: 14px; padding: 8px 8px 8px 10px; }
	img, .ph { width: 44px; height: 44px; border-radius: 8px; object-fit: contain; flex: none; background: #f4f1ec; }
	.t { flex: 1; min-width: 0; font-weight: 700; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.star { color: var(--red, #c8102e); margin-right: 6px; }
	li button { width: 44px; height: 44px; border-radius: 10px; border: 2px solid var(--ink); background: #fff; color: var(--ink); display: flex; align-items: center; justify-content: center; flex: none; }
	li button:disabled { opacity: 0.25; }
	.acts > form, .acts > .btn { width: auto; }
	.acts .btn { width: auto; min-height: 48px; }
	.acts { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 16px; }
	.link { background: none; border: 0; text-decoration: underline; font-weight: 700; color: var(--ink); min-height: 44px; padding: 0 6px; }
</style>
