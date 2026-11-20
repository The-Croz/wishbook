<script lang="ts">
	import type { ItemView } from '$lib/types';
	import GiftCard from './GiftCard.svelte';
	let { items }: { items: ItemView[] } = $props();
</script>

<div class="grid">{#each items as item, i (item.id)}<GiftCard {item} n={i + 1} />{/each}</div>

<style>
	.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px 12px; }
	@media (min-width: 560px) { .grid { grid-template-columns: repeat(3, 1fr); } }
	@media (min-width: 900px) { .grid { --art-h: 168px; gap: 30px 24px; } }
	@media (min-width: 1280px) { .grid { grid-template-columns: repeat(4, 1fr); --art-h: 176px; } }
</style>
