<script lang="ts">
	let { src, store, title, height = 132 }: { src: string | null; store: string | null; title: string; height?: number } = $props();
	let broken = $state(false);
	const initial = $derived((store ?? title).trim().charAt(0).toUpperCase() || '?');
</script>

<div class="art" style:height="{height}px">
	{#if src && !broken}
		<img {src} alt="" loading="lazy" referrerpolicy="no-referrer" onerror={() => (broken = true)} />
	{:else}
		<span aria-hidden="true">{initial}</span>
	{/if}
</div>

<style>
	.art { background: var(--wash); border-radius: 4px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
	img { width: 100%; height: 100%; object-fit: contain; padding: 10px; mix-blend-mode: multiply; }
	span { font-family: var(--display); font-size: 40px; color: var(--rule); }
</style>
