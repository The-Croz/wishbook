<script lang="ts">
	import { page } from '$app/state';
	import Icon from './Icon.svelte';
	const tabs = [
		{ href: '/', label: 'Family', icon: 'book' as const, match: (p: string) => p === '/' || p.startsWith('/people') },
		{ href: '/me/list', label: 'My list', icon: 'star' as const, match: (p: string) => p.startsWith('/me/list') },
		{ href: '/getting', label: "I'm getting", icon: 'gift' as const, match: (p: string) => p.startsWith('/getting') },
		{ href: '/me', label: 'Me', icon: 'user' as const, match: (p: string) => p === '/me' || p.startsWith('/me/archive') || p.startsWith('/admin') }
	];
</script>

<nav aria-label="Main">
	{#each tabs as t}
		{@const on = t.match(page.url.pathname)}
		<a href={t.href} class:on aria-current={on ? 'page' : undefined}><Icon name={t.icon} size={26} />{t.label}</a>
	{/each}
</nav>

<style>
	nav { position: fixed; left: 0; right: 0; bottom: 0; z-index: 20; background: #fff; border-top: 2px solid var(--ink); display: flex; justify-content: space-around; padding: 8px 0 calc(8px + env(safe-area-inset-bottom)); }
	a { display: flex; flex-direction: column; align-items: center; gap: 3px; min-width: 72px; min-height: 52px; justify-content: center; font-size: 12px; font-weight: 700; color: var(--muted); text-decoration: none; }
	a.on { color: var(--red); }
</style>
