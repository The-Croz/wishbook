<script lang="ts">
	import { avatarSrc, initials } from '$lib/avatar';
	let { name, color, photo = null, size = 40, display = false }: { name: string; color: string; photo?: string | null; size?: number; display?: boolean } = $props();
	const src = $derived(avatarSrc(photo));
</script>

<span class="av" class:display style:background={color} style:width="{size}px" style:height="{size}px" style:font-size="{Math.round(size * (display ? 0.38 : 0.37))}px" aria-hidden="true">
	{#if src}<img {src} alt="" width={size} height={size} loading="lazy" />{:else}{initials(name)}{/if}
</span>

<style>
	.av { border-radius: 50%; color: var(--ink); font-weight: 700; display: inline-flex; align-items: center; justify-content: center; flex: none; overflow: hidden; }
	.display { font-family: var(--display); font-weight: 400; }
	img { width: 100%; height: 100%; object-fit: cover; display: block; }
</style>
