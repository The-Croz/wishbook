<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import BudgetPerson from '$lib/components/BudgetPerson.svelte';
	import { centsToInput, formatMoney } from '$lib/money';
	let { data, form } = $props();

	const usd = (c: number) => formatMoney(c, 'USD');
	const keep: SubmitFunction = () => async ({ update }) => update({ reset: false });
	const submit = (e: Event) => (e.currentTarget as HTMLInputElement).form?.requestSubmit();
	const shared = $derived(data.partner != null);
	const left = $derived(data.totalCents != null ? data.totalCents - data.plannedCents : null);
	const pct = (part: number) => (data.totalCents ? Math.min(100, (part / data.totalCents) * 100) : 0);
	/** People you've planned for, plus anyone you added by hand (so they don't vanish the moment you add them). */
	const isActive = (p: (typeof data.people)[number]) => p.kind === 'person' || p.gifts.length > 0 || p.limitCents != null;
	const active = $derived(data.people.filter(isActive));
	const rest = $derived(data.people.filter((p) => !isActive(p)));
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
		<dl class="stats num">
			<div><dt>Spent</dt><dd>{usd(data.spentCents)}</dd></div>
			<div><dt>Planned</dt><dd>{usd(data.plannedCents)}</dd></div>
			<div><dt>People</dt><dd>{active.length}</dd></div>
		</dl>
		<p class="key"><i class="k-spent"></i>Bought or later <i class="k-plan"></i>Claimed, not bought yet</p>

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

	<div class="secthd"><b>Who you’re buying for</b><span>Status · Paid</span></div>
	{#if !active.length}
		<div class="empty"><b>Nothing planned yet</b>Gifts you claim on Wishbook show up here. Set a budget for someone or add a gift you bought somewhere else.</div>
	{/if}
	{#each active as p (p.key)}
		<BudgetPerson person={p} {shared} meId={data.me.id} />
	{/each}

	{#if rest.length}
		<button type="button" class="more" onclick={() => (showRest = !showRest)} aria-expanded={showRest}>
			{showRest ? 'Hide' : 'Show'} everyone else ({rest.length})
		</button>
		{#if showRest}
			{#each rest as p (p.key)}<BudgetPerson person={p} {shared} meId={data.me.id} />{/each}
		{/if}
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
	.stats { display: flex; gap: 28px; margin-top: 12px; }
	.stats dt { font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
	.stats dd { margin: 0; font-family: var(--display); font-size: 21px; }
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
	.more { border: 0; background: none; color: var(--ink); font-weight: 700; padding: 14px 0; min-height: 44px; text-decoration: underline; }
	.addp { margin-top: 28px; padding: 16px; background: var(--wash); border-radius: 14px; }
	.addp label { display: block; font-weight: 700; margin-bottom: 8px; }
	.addp .row2 { align-items: stretch; }
	.addp .btn { flex: 0 0 96px; }

	@media (min-width: 900px) {
		.sum { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); column-gap: 40px; align-items: end; max-width: 980px; }
		.sum .total, .sum .meter, .sum .left, .sum .key { grid-column: 1; }
		.sum .stats { grid-column: 2; grid-row: 1; justify-self: end; }
		.sum .share { grid-column: 1 / -1; }
		.big { font-size: 56px; }
		.addp { max-width: 560px; }
	}
</style>
