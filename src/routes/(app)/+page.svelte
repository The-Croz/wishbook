<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	let { data } = $props();
	const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
</script>

<svelte:head><title>Family · Wishbook</title></svelte:head>

<header class="hdr">
	<div class="top"><span class="wm"><img src="/brand/stack.svg" alt="" width="26" height="26" />Wishbook</span><a class="av" href="/me" style:background={data.me.avatarColor} aria-label="Me">{initials(data.me.displayName)}</a></div>
	<h1>Who’s on the list this year</h1>
	<p class="meta">Christmas {data.season}{#if data.daysToGo > 0}{' · '}{data.daysToGo} {data.daysToGo === 1 ? 'day' : 'days'} to go{:else if data.daysToGo === 0}{' · '}Merry Christmas!{/if}</p>
</header>

<main class="pg">
	<div class="secthd"><b>Family</b><span>{data.family.length} {data.family.length === 1 ? 'list' : 'lists'}</span></div>
	{#if data.family.length === 0}
		<div class="empty"><b>It’s just you so far</b>Ask {data.me.isAdmin ? 'yourself (you’re the admin)' : 'the admin'} to add the rest of the family.</div>
	{/if}
	{#each data.family as p (p.ownerId)}
		<a class="person" href="/people/{p.ownerId}">
			<span class="pav" style:background={p.avatarColor}>{initials(p.displayName)}</span>
			<span class="body">
				<span class="nm">{p.displayName}{#if p.isManaged}<span class="tag">KID</span>{/if}</span>
				<span class="sm">
					{#if p.managedByMe}{'You manage · '}{/if}{#if p.wantCount === 0}No gifts yet{:else}{p.wantCount} {p.wantCount === 1 ? 'want' : 'wants'}{#if p.claimedCount !== undefined}{` · ${p.claimedCount} claimed`}{/if}{/if}
				</span>
				{#if p.claimedCount !== undefined && p.wantCount > 0}
					<span class="bar" role="img" aria-label="{p.claimedCount} of {p.wantCount} claimed"><i style:width="{Math.round((p.claimedCount / p.wantCount) * 100)}%"></i></span>
				{/if}
			</span>
			<span class="go"><Icon name="chev" size={20} /></span>
		</a>
	{/each}
</main>

<style>
	.top { display: flex; justify-content: space-between; align-items: center; }
	.wm { font-family: var(--display); font-size: 20px; display: flex; align-items: center; gap: 8px; }
	.av { width: 40px; height: 40px; border-radius: 50%; color: var(--ink); font-weight: 700; display: flex; align-items: center; justify-content: center; font-size: 15px; text-decoration: none; }
	.person { display: flex; align-items: center; gap: 14px; padding: 14px 0; border-bottom: 1px solid var(--rule); color: var(--ink); text-decoration: none; min-height: 72px; }
	.pav { width: 52px; height: 52px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: var(--display); font-size: 20px; flex: none; }
	.body { display: flex; flex-direction: column; min-width: 0; }
	.nm { font-weight: 700; font-size: 18px; }
	.sm { font-size: 15px; color: var(--muted); }
	.bar { height: 8px; background: var(--wash); border-radius: 4px; margin-top: 6px; overflow: hidden; width: 150px; display: block; }
	.bar i { display: block; height: 100%; background: var(--pine); }
	.go { margin-left: auto; color: var(--muted); }
	.tag { font-size: 12px; font-weight: 700; letter-spacing: 0.06em; background: var(--mustard); padding: 2px 6px; border-radius: 4px; margin-left: 6px; vertical-align: 2px; }
</style>
