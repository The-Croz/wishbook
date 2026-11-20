<script lang="ts">
	import { SORT_LABELS, type SortMode } from '$lib/sortGifts';
	let { value = $bindable(), customOrder, ownList = false }: { value: SortMode; customOrder: boolean; ownList?: boolean } = $props();
	const modes = $derived((Object.keys(SORT_LABELS) as SortMode[]).filter((m) => m !== 'list' || customOrder));
	const label = (m: SortMode) => (m === 'list' && ownList ? 'My order' : SORT_LABELS[m]);
</script>

<label class="sort">
	<span>Sort</span>
	<select bind:value>
		{#each modes as m (m)}<option value={m}>{label(m)}</option>{/each}
	</select>
</label>

<style>
	.sort { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; }
	select { min-height: 40px; padding: 0 32px 0 12px; border-radius: 99px; border: 2px solid var(--ink); background: #fff; color: var(--ink); font: inherit; font-weight: 700; }
</style>
