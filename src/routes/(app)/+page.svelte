<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import GiftArt from '$lib/components/GiftArt.svelte';
	import { formatMoney } from '$lib/money';
	let { data } = $props();
	const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
</script>

<svelte:head><title>Family · Wishbook</title></svelte:head>

<header class="hdr">
	<div class="top mob"><span class="wm"><img src="/brand/stack.svg" alt="" width="26" height="26" />Wishbook</span><a class="av" href="/me" style:background={data.me.avatarColor} aria-label="Me">{initials(data.me.displayName)}</a></div>
	<h1>Who’s on the list this year</h1>
	<p class="meta eyebrow">Christmas {data.season}{#if data.daysToGo > 0}{' · '}{data.daysToGo} {data.daysToGo === 1 ? 'day' : 'days'} to go{:else if data.daysToGo === 0}{' · '}Merry Christmas!{/if}</p>
</header>

<main class="pg">
	<div class="split">
		<div>
			<div class="secthd"><b>Family</b><span>{data.family.length} {data.family.length === 1 ? 'list' : 'lists'}</span></div>
			{#if data.family.length === 0}
				<div class="empty"><b>It’s just you so far</b>Ask {data.me.isAdmin ? 'yourself (you’re the admin)' : 'the admin'} to add the rest of the family.</div>
			{/if}
			<div class="people">
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
			</div>
		</div>
		<aside class="side" aria-label="Gifts I’m getting">
			<div class="secthd"><b>I’m getting</b><span class="num">{data.getting.count} {data.getting.count === 1 ? 'gift' : 'gifts'}{data.getting.total ? ` · ${formatMoney(data.getting.total, 'USD')}` : ''}</span></div>
			{#each data.getting.recent as g (g.id)}
				<a class="grow" href="/items/{g.id}">
					<span class="gth"><GiftArt src={g.imageUrl} store={g.store} title={g.title} height={52} /></span>
					<span class="gbody"><span class="gt">{g.title}</span><span class="gsm">For {g.ownerName} · {#if g.purchased}<b class="bought">Bought</b>{:else}Not bought yet{/if}</span></span>
					{#if g.priceCents != null}<span class="gpr num">{formatMoney(g.priceCents, g.currency)}</span>{/if}
				</a>
			{:else}
				<p class="gsm">Nothing yet. Open someone’s list and tap “I’ll get this”.</p>
			{/each}
			<a class="more" href="/getting">See everything I’m getting</a>
		</aside>
	</div>
</main>

<style>
	.grow { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--rule); color: var(--ink); text-decoration: none; }
	.gth { width: 52px; flex: none; }
	.gbody { display: flex; flex-direction: column; min-width: 0; }
	.gt { font-weight: 700; font-size: 15px; line-height: 1.2; }
	.gsm { font-size: 14px; color: var(--muted); }
	.gpr { margin-left: auto; font-family: var(--display); font-size: 16px; color: var(--red); flex: none; }
	.bought { color: var(--pine); }
	.more { display: inline-block; margin-top: 10px; color: var(--red); font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
	.people { display: block; }
	.side { display: none; }
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
	@media (min-width: 900px) {
		.people { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
		.person { border: 2px solid var(--rule); border-radius: 16px; padding: 16px; min-height: 104px; }
		.person:hover { border-color: var(--ink); box-shadow: 0 4px 0 var(--ink); transform: translateY(-2px); }
		.pav { width: 56px; height: 56px; }
		.nm { font-size: 19px; }
		.bar { width: 120px; max-width: 100%; }
	}
	@media (min-width: 1280px) {
		.split { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 32px; align-items: start; }
		.side { display: block; background: var(--wash); border-radius: 16px; padding: 18px; }
	}
</style>
