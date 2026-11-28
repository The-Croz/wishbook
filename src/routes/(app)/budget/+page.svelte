<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import BudgetPerson from '$lib/components/BudgetPerson.svelte';
	import BudgetGiftRow from '$lib/components/BudgetGiftRow.svelte';
	import { STATUS_LABELS, STATUS_ORDER, type GiftStatusName } from '$lib/giftStatus';
	import { centsToInput, formatMoney } from '$lib/money';
	let { data, form } = $props();

	type Person = (typeof data.people)[number];
	const usd = (c: number) => formatMoney(c, 'USD');
	const keep: SubmitFunction = () => async ({ update }) => update({ reset: false });
	const submit = (e: Event) => (e.currentTarget as HTMLInputElement).form?.requestSubmit();
	const shared = $derived(data.partner != null);
	const left = $derived(data.totalCents != null ? data.totalCents - data.plannedCents : null);
	const pct = (part: number) => (data.totalCents ? Math.min(100, (part / data.totalCents) * 100) : 0);

	// ---- the numbers at the top ----
	const allGifts = $derived(data.people.flatMap((p) => p.gifts.map((g) => ({ g, p }))));
	/** What the per-person budgets add up to, next to the overall budget. */
	const assigned = $derived(data.people.reduce((n, p) => n + (p.limitCents ?? 0), 0));
	const unassigned = $derived(data.totalCents != null ? data.totalCents - assigned : null);
	const counts = $derived(Object.fromEntries(STATUS_ORDER.map((s) => [s, allGifts.filter((x) => x.g.status === s).length])) as Record<GiftStatusName, number>);
	const toBuyCents = $derived(allGifts.filter((x) => x.g.status === 'claimed').reduce((n, x) => n + (x.g.totalCents ?? 0), 0));
	const toWrap = $derived(counts.purchased + counts.shipped + counts.arrived);
	const overPeople = $derived(data.people.filter((p) => p.limitCents != null && p.plannedCents > p.limitCents));

	// ---- how the list below is shown; remembered on this device ----
	type View = 'person' | 'stage';
	type Sort = 'name' | 'planned' | 'over' | 'tobuy';
	const SORTS: [Sort, string][] = [['name', 'A to Z'], ['planned', 'Most planned'], ['over', 'Over budget first'], ['tobuy', 'Most still to buy']];
	let view = $state<View>('person');
	let sort = $state<Sort>('name');
	let only = $state<GiftStatusName | null>(null);
	let ready = false;
	onMount(() => {
		try {
			const saved = JSON.parse(localStorage.getItem('budget-view') ?? '{}');
			if (saved.view === 'stage') view = 'stage';
			if (SORTS.some(([k]) => k === saved.sort)) sort = saved.sort;
			if (STATUS_ORDER.includes(saved.only)) only = saved.only;
		} catch { /* private mode or nothing saved */ }
		// Arriving from someone's page ("See in Budget"): show people, unfiltered, and scroll to them.
		if (location.hash.startsWith('#person-')) {
			view = 'person';
			only = null;
			const key = location.hash.slice('#person-'.length).replace('-', ':');
			if (!data.people.find((p) => p.key === key && isActive(p))) showRest = true;
			tick().then(() => document.getElementById(location.hash.slice(1))?.scrollIntoView());
		}
		ready = true;
	});
	$effect(() => {
		const v = JSON.stringify({ view, sort, only });
		if (ready) try { localStorage.setItem('budget-view', v); } catch { /* private mode */ }
	});

	/** People you've planned for, plus anyone you added by hand (so they don't vanish the moment you add them). */
	const isActive = (p: Person) => p.kind === 'person' || p.gifts.length > 0 || p.limitCents != null;
	const stillToBuy = (p: Person) => p.gifts.filter((g) => g.status === 'claimed').length;
	const overBy = (p: Person) => (p.limitCents == null ? -Infinity : p.plannedCents - p.limitCents);
	const sorters: Record<Sort, (a: Person, b: Person) => number> = {
		name: () => 0,
		planned: (a, b) => b.plannedCents - a.plannedCents,
		over: (a, b) => overBy(b) - overBy(a),
		tobuy: (a, b) => stillToBuy(b) - stillToBuy(a)
	};
	const active = $derived(data.people.filter(isActive)
		.filter((p) => !only || p.gifts.some((g) => g.status === only))
		.sort((a, b) => sorters[sort](a, b) || a.name.localeCompare(b.name)));
	const rest = $derived(only ? [] : data.people.filter((p) => !isActive(p)));
	const stages = $derived((only ? [only] : STATUS_ORDER).map((s) => {
		const rows = allGifts.filter((x) => x.g.status === s).sort((a, b) => a.p.name.localeCompare(b.p.name) || a.g.title.localeCompare(b.g.title));
		return { s, rows, cents: rows.reduce((n, x) => n + (x.g.totalCents ?? 0), 0) };
	}).filter((st) => st.rows.length));
	let showRest = $state(false);
	let inviteId = $state('');
</script>

<svelte:head><title>Budget · Wishbook</title></svelte:head>

<header class="hdr">
	<h1>Budget</h1>
	<p class="meta num">{usd(data.spentCents)} spent · {usd(data.plannedCents)} planned{shared ? ` · with ${data.partner!.displayName}` : ''}</p>
</header>

<main class="pg">
	{#each data.invitesIn as inv (inv.id)}
		<div class="invite">
			<p><b>{inv.displayName}</b> wants to share a budget with you. You’d both see one plan and every gift either of you is buying, except gifts for each other.</p>
			<div class="row2">
				<form method="POST" action="?/accept" use:enhance><input type="hidden" name="id" value={inv.id} /><button class="btn pine">Share with {inv.displayName}</button></form>
				<form method="POST" action="?/decline" use:enhance><input type="hidden" name="id" value={inv.id} /><button class="btn ghost">No thanks</button></form>
			</div>
		</div>
	{/each}

	<section class="sum">
		<form method="POST" action="?/total" use:enhance={keep} class="total">
			<label>
				<span class="cap">{shared ? 'Our' : 'My'} {data.season} budget</span>
				<span class="big"><i>$</i><input class="num" name="cents" inputmode="decimal" autocomplete="off" value={centsToInput(data.totalCents)} placeholder="Set a budget" onchange={submit} aria-label="Overall budget" /></span>
			</label>
		</form>
		{#if data.totalCents}
			<div class="meter" aria-hidden="true"><i class="plan" style:width="{pct(data.plannedCents)}%"></i><i class="spent" style:width="{pct(data.spentCents)}%"></i></div>
			<p class="left num" class:over={left! < 0}>{left! >= 0 ? `${usd(left!)} left to plan` : `Over budget by ${usd(-left!)}`}</p>
		{/if}
		{#if data.totalCents}<p class="key"><i class="k-spent"></i>Bought or later <i class="k-plan"></i>Claimed, not bought yet</p>{/if}
		<dl class="stats num">
			<div><dt>Spent</dt><dd>{usd(data.spentCents)}</dd><span>bought or later</span></div>
			<div><dt>Planned</dt><dd>{usd(data.plannedCents)}</dd><span>{allGifts.length} {allGifts.length === 1 ? 'gift' : 'gifts'}</span></div>
			<div class:warn={unassigned != null && unassigned < 0}>
				<dt>Budgeted to people</dt><dd>{usd(assigned)}</dd>
				<span>{#if data.totalCents == null}no overall budget yet{:else if unassigned! >= 0}of {usd(data.totalCents)} · {usd(unassigned!)} unassigned{:else}{usd(-unassigned!)} more than {usd(data.totalCents)}{/if}</span>
			</div>
			<div><dt>Still to buy</dt><dd>{counts.claimed}</dd><span>{counts.claimed ? `${usd(toBuyCents)} to go` : 'all bought'}</span></div>
			<div><dt>To wrap</dt><dd>{toWrap}</dd><span>{counts.shipped ? `${counts.shipped} on the way` : `${counts.wrapped} wrapped`}</span></div>
			<div class:warn={overPeople.length > 0}><dt>Over budget</dt><dd>{overPeople.length}</dd><span>{overPeople.length ? overPeople.map((p) => p.name).join(', ') : 'nobody'}</span></div>
		</dl>

		<div class="share">
			{#if data.partner}
				<span>Shared with <b>{data.partner.displayName}</b></span>
				<form method="POST" action="?/stopSharing" use:enhance onsubmit={(e) => { if (!confirm(`Stop sharing with ${data.partner!.displayName}? You’ll each keep a copy of the plan.`)) e.preventDefault(); }}>
					<button class="link">Stop sharing</button>
				</form>
			{:else if data.invitesOut.length}
				{#each data.invitesOut as o (o.id)}
					<span>Waiting for <b>{o.displayName}</b> to accept</span>
					<form method="POST" action="?/cancelInvite" use:enhance><input type="hidden" name="id" value={o.id} /><button class="link">Cancel</button></form>
				{/each}
			{:else if data.canInvite.length && !data.invitesIn.length}
				<form method="POST" action="?/invite" use:enhance class="inv">
					<label for="partner">Share with your spouse</label>
					<select id="partner" name="id" bind:value={inviteId}>
						<option value="" disabled>Pick someone</option>
						{#each data.canInvite as c (c.id)}<option value={String(c.id)}>{c.displayName}</option>{/each}
					</select>
					<button class="link" disabled={!inviteId}>Share</button>
				</form>
			{/if}
		</div>
	</section>

	{#if form?.message}<p class="err" role="alert">{form.message}</p>{/if}

	{#if data.hidden}
		<p class="note secret">🤫 {data.hidden.fromName} is getting you {data.hidden.count === 1 ? 'a gift' : `${data.hidden.count} gifts`}. {data.hidden.count === 1 ? 'It’s' : 'They’re'} in the totals but hidden here, so it stays a surprise.</p>
	{/if}

	<div class="secthd"><b>{view === 'person' ? 'Who you’re buying for' : 'Where every gift is'}</b><span>Status · Paid</span></div>
	<div class="tools">
		<div class="seg" role="group" aria-label="Group gifts">
			<button type="button" class:on={view === 'person'} aria-pressed={view === 'person'} onclick={() => (view = 'person')}>By person</button>
			<button type="button" class:on={view === 'stage'} aria-pressed={view === 'stage'} onclick={() => (view = 'stage')}>By stage</button>
		</div>
		{#if view === 'person'}
			<label class="sortl">Sort
				<select bind:value={sort}>{#each SORTS as [k, label]}<option value={k}>{label}</option>{/each}</select>
			</label>
		{/if}
	</div>
	<div class="chips" role="group" aria-label="Show gifts at one stage">
		<button type="button" class:on={!only} aria-pressed={!only} onclick={() => (only = null)}>All <span class="num">{allGifts.length}</span></button>
		{#each STATUS_ORDER as st}
			<button type="button" class="c-{st}" class:on={only === st} aria-pressed={only === st} disabled={!counts[st] && only !== st}
				onclick={() => (only = only === st ? null : st)}>{STATUS_LABELS[st]} <span class="num">{counts[st]}</span></button>
		{/each}
	</div>

	{#if view === 'person'}
		{#if !active.length}
			<div class="empty">{#if only}<b>No gifts at “{STATUS_LABELS[only]}”</b>Pick another stage or All.{:else}<b>Nothing planned yet</b>Gifts you claim on Wishbook show up here. Set a budget for someone or add a gift you bought somewhere else.{/if}</div>
		{/if}
		{#each active as p (p.key)}
			<BudgetPerson person={p} {shared} meId={data.me.id} {only} />
		{/each}

		{#if rest.length}
			<button type="button" class="more" onclick={() => (showRest = !showRest)} aria-expanded={showRest}>
				{showRest ? 'Hide' : 'Show'} everyone else ({rest.length})
			</button>
			{#if showRest}
				{#each rest as p (p.key)}<BudgetPerson person={p} {shared} meId={data.me.id} />{/each}
			{/if}
		{/if}
	{:else}
		{#if !stages.length}<div class="empty"><b>No gifts yet</b>Claim something on Wishbook or add a gift by person.</div>{/if}
		{#each stages as st (st.s)}
			<section class="stagegrp">
				<h2><span class="dot c-{st.s}"></span>{STATUS_LABELS[st.s]}<span class="num">{st.rows.length} {st.rows.length === 1 ? 'gift' : 'gifts'} · {usd(st.cents)}</span></h2>
				{#each st.rows as { g, p } (g.key)}
					<BudgetGiftRow {g} {shared} meId={data.me.id} forName={p.name} forHref={p.kind === 'user' ? `/people/${p.key.slice(2)}` : undefined} />
				{/each}
			</section>
		{/each}
		<p class="hint">Add or edit gifts from <button type="button" class="inline" onclick={() => (view = 'person')}>By person</button>.</p>
	{/if}

	<form method="POST" action="?/addPerson" use:enhance class="addp">
		<label for="newp">Buying for someone who isn’t on Wishbook?</label>
		<div class="row2">
			<input id="newp" class="field" name="name" placeholder="Their name, like “Mrs. Lee”" maxlength="80" required />
			<button class="btn ink">Add</button>
		</div>
	</form>
</main>

<style>
	.invite { background: #e6f2ec; border-radius: 14px; padding: 16px; margin-bottom: 18px; }
	.invite p { margin-bottom: 12px; }
	.row2 { display: flex; gap: 10px; }
	.row2 > * { flex: 1; }
	.row2 .btn { min-height: 50px; font-size: 16px; }

	.sum { padding: 4px 0 18px; margin-bottom: 18px; }
	.cap { display: block; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
	.big { display: flex; align-items: baseline; font-family: var(--display); font-size: 44px; line-height: 1.05; color: var(--ink); }
	.big i { font-style: normal; color: var(--muted); font-size: 30px; margin-right: 2px; }
	.big input { font-family: inherit; font-size: inherit; border: 0; border-bottom: 3px dashed var(--rule); background: transparent; width: 100%; max-width: 320px; padding: 0; min-height: 56px; }
	.big input::placeholder { color: #bdb9b2; font-size: 30px; }
	.big input:hover { border-bottom-color: var(--muted); }
	.big input:focus { outline: none; border-bottom: 3px solid var(--red); }
	.meter { position: relative; height: 14px; border-radius: 7px; background: var(--wash); overflow: hidden; margin-top: 14px; }
	.meter i { position: absolute; inset: 0 auto 0 0; border-radius: 7px; }
	.meter .plan { background: #f3b6c0; }
	.meter .spent { background: var(--red); }
	.left { font-weight: 700; margin-top: 8px; color: var(--pine); }
	.left.over { color: var(--red); }
	.stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px 18px; margin-top: 18px; }
	.stats > div { min-width: 0; }
	.stats dt { font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
	.stats dd { margin: 0; font-family: var(--display); font-size: 22px; line-height: 1.2; }
	.stats span { display: block; font-size: 13px; color: var(--muted); font-weight: 700; overflow-wrap: anywhere; }
	.stats .warn dd, .stats .warn span { color: var(--red); }
	.key { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 13px; color: var(--muted); margin-top: 8px; }
	.key i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; }
	.key i + i, .key .k-plan { margin-left: 8px; }
	.k-spent { background: var(--red); }
	.k-plan { background: #f3b6c0; }

	.share { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 12px; margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--rule); font-size: 15px; }
	.inv { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
	.inv label { font-weight: 700; }
	.inv select { border: 2px solid var(--ink); border-radius: 10px; padding: 8px 10px; min-height: 44px; background: #fff; }
	.link { border: 0; background: none; color: var(--red); font-weight: 700; padding: 8px 4px; min-height: 44px; }
	.link:disabled { color: var(--muted); }

	.secret { background: #fff7d6; }
	.tools { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
	.seg { display: inline-flex; background: var(--wash); border-radius: 12px; padding: 3px; }
	.seg button { border: 0; background: transparent; border-radius: 9px; padding: 0 14px; min-height: 40px; font-weight: 700; font-size: 15px; color: var(--muted); }
	.seg button.on { background: #fff; color: var(--ink); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12); }
	.sortl { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; font-size: 15px; color: var(--muted); }
	.sortl select { border: 2px solid var(--ink); border-radius: 10px; padding: 6px 8px; min-height: 40px; background: #fff; font-weight: 700; color: var(--ink); }
	.chips { display: flex; gap: 8px; overflow-x: auto; padding: 2px 0 10px; scrollbar-width: none; }
	.chips button { flex: none; border: 2px solid var(--ink); background: #fff; border-radius: 999px; padding: 0 14px; min-height: 40px; font-weight: 700; font-size: 14px; display: inline-flex; align-items: center; gap: 6px; }
	.chips button .num { color: var(--muted); }
	.chips button.on { background: var(--ink); color: #fff; }
	.chips button.on .num { color: #d8d5cf; }
	.chips button:disabled { opacity: 0.4; cursor: default; }
	.dot { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 8px; vertical-align: 1px; }
	.c-claimed.dot { background: #cfcbc3; }
	.c-purchased.dot { background: #f2c94c; }
	.c-shipped.dot { background: #8fb4de; }
	.c-arrived.dot { background: #8cc7a8; }
	.c-wrapped.dot { background: var(--pine); }
	.stagegrp { padding: 10px 0 14px; border-bottom: 1px solid var(--rule); }
	.stagegrp h2 { font-family: var(--display); font-weight: 400; font-size: 19px; display: flex; align-items: center; flex-wrap: wrap; column-gap: 0; }
	.stagegrp h2 .num { font-family: var(--body); font-size: 14px; color: var(--muted); font-weight: 700; margin-left: 10px; }
	.hint { color: var(--muted); font-size: 14px; margin-top: 14px; }
	.inline { border: 0; background: none; padding: 0; color: var(--red); font-weight: 700; text-decoration: underline; }
	.more { border: 0; background: none; color: var(--ink); font-weight: 700; padding: 14px 0; min-height: 44px; text-decoration: underline; }
	.addp { margin-top: 28px; padding: 16px; background: var(--wash); border-radius: 14px; }
	.addp label { display: block; font-weight: 700; margin-bottom: 8px; }
	.addp .row2 { align-items: stretch; }
	.addp .btn { flex: 0 0 96px; }

	@media (min-width: 900px) {
		.sum { max-width: 1040px; }
		.sum .meter { max-width: 640px; }
		.stats { grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 18px 24px; margin-top: 22px; padding-top: 16px; border-top: 1px solid var(--rule); }
		.big { font-size: 56px; }
		.addp { max-width: 560px; }
	}
</style>
