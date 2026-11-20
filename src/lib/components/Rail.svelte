<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from './Icon.svelte';
	import { tabs } from '$lib/nav';

	let { me, countdown }: { me: { displayName: string; avatarColor: string }; countdown: { season: number; daysToGo: number } } = $props();
	const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

	/** 1–4 jump between the main sections, unless someone is typing. */
	function onkey(e: KeyboardEvent) {
		if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || !matchMedia('(min-width: 900px)').matches) return;
		const t = e.target as HTMLElement | null;
		if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
		const tab = tabs[Number(e.key) - 1];
		if (tab) { e.preventDefault(); goto(tab.href); }
	}
</script>

<svelte:window onkeydown={onkey} />

<aside class="rail">
	<a class="brand" href="/"><img src="/brand/stack.svg" alt="" width="28" height="36" />Wishbook</a>
	<nav aria-label="Main">
		{#each tabs as t, i}
			{@const on = t.match(page.url.pathname)}
			<a href={t.href} class:on aria-current={on ? 'page' : undefined} aria-keyshortcuts={String(i + 1)}><Icon name={t.icon} size={22} />{t.label}<kbd aria-hidden="true">{i + 1}</kbd></a>
		{/each}
	</nav>
	<a class="add" href="/add"><Icon name="plus" size={20} />Add a gift</a>
	{#if countdown.daysToGo >= 0}
		<div class="days">
			<span>Christmas {countdown.season}</span>
			{#if countdown.daysToGo === 0}<b>Merry Christmas!</b>{:else}<b>{countdown.daysToGo} {countdown.daysToGo === 1 ? 'day' : 'days'}</b><span>to go</span>{/if}
		</div>
	{/if}
	<a class="who" href="/me"><span class="av" style:background={me.avatarColor}>{initials(me.displayName)}</span><span><b>{me.displayName}</b><span>Account and notifications</span></span></a>
</aside>

<style>
	.rail { display: none; }
	@media (min-width: 900px) {
		.rail { display: flex; flex-direction: column; gap: 24px; position: sticky; top: 0; height: 100dvh; padding: 26px 18px 18px 20px; color: #fff; overflow-y: auto; }
		/* stitching along the spine: the red is the cover, the white is the page */
		.rail::after { content: ''; position: absolute; top: 16px; bottom: 16px; right: 5px; border-right: 2px dashed rgba(255, 255, 255, 0.3); pointer-events: none; }
	}
	.brand { display: flex; align-items: center; gap: 10px; font-family: var(--display); font-size: 23px; letter-spacing: -0.01em; color: #fff; text-decoration: none; padding-left: 6px; }
	nav { display: flex; flex-direction: column; gap: 6px; }
	nav a { display: flex; align-items: center; gap: 12px; min-height: 50px; padding: 0 14px; border-radius: 12px; font-weight: 700; font-size: 17px; color: #fff; text-decoration: none; }
	nav a:hover { background: rgba(255, 255, 255, 0.14); }
	nav a.on { background: #fff; color: var(--red); }
	nav a:focus-visible { outline-offset: 0; }
	kbd { margin-left: auto; font: 700 12px var(--body); opacity: 0.65; border: 1.5px solid currentColor; border-radius: 5px; padding: 0 5px; }
	.add { min-height: 52px; border-radius: 14px; background: var(--ink); color: #fff; font-weight: 700; font-size: 17px; display: flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; }
	.add:hover { background: #000; }
	.days { background: var(--mustard); color: var(--ink); border-radius: 14px; padding: 14px 16px; display: flex; flex-direction: column; }
	.days b { font-family: var(--display); font-weight: 400; font-size: 30px; line-height: 1.05; }
	.days span { font-size: 14px; font-weight: 700; }
	.who { margin-top: auto; display: flex; align-items: center; gap: 10px; padding: 8px 6px; border-radius: 12px; color: #fff; text-decoration: none; min-height: 56px; }
	.who:hover { background: rgba(255, 255, 255, 0.14); }
	.av { width: 40px; height: 40px; border-radius: 50%; color: var(--ink); font-weight: 700; display: flex; align-items: center; justify-content: center; font-size: 15px; flex: none; }
	.who b { display: block; font-size: 15px; line-height: 1.15; }
	.who span span { font-size: 13px; color: var(--pink); display: block; line-height: 1.2; }
</style>
