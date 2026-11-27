<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { BudgetPerson } from '$lib/server/budget';
	import { STATUS_LABELS, STATUS_ORDER } from '$lib/giftStatus';
	import { centsToInput, formatMoney } from '$lib/money';
	import Avatar from './Avatar.svelte';
	import Icon from './Icon.svelte';

	let { person, shared, meId }: { person: BudgetPerson; shared: boolean; meId: number } = $props();

	let adding = $state(false);
	let editing = $state<string | null>(null);
	let renaming = $state(false);

	/** Saves without clearing what's typed, so the row stays as the person left it. */
	const keep: SubmitFunction = () => async ({ update }) => update({ reset: false });
	const closeAfter = (done: () => void): SubmitFunction => () => async ({ result, update }) => {
		await update({ reset: false });
		if (result.type === 'success') done();
	};
	const submit = (e: Event) => (e.currentTarget as HTMLInputElement | HTMLSelectElement).form?.requestSubmit();
	const usd = (c: number) => formatMoney(c, 'USD');
	const over = $derived(person.limitCents != null && person.plannedCents > person.limitCents);
	const pct = (part: number) => (person.limitCents ? Math.min(100, (part / person.limitCents) * 100) : 0);
</script>

<section class="person" class:empty={!person.gifts.length}>
	<header>
		{#if person.kind === 'user'}
			<Avatar name={person.name} color={person.avatarColor ?? '#F2B705'} photo={person.avatarPhoto} size={40} />
		{:else}
			<Avatar name={person.name} color="#f4f2ee" size={40} />
		{/if}
		<div class="who">
			{#if renaming}
				<form method="POST" action="?/renamePerson" use:enhance={closeAfter(() => (renaming = false))} class="rename">
					<input type="hidden" name="id" value={person.key.slice(2)} />
					<input class="line-in" name="name" value={person.name} aria-label="Name" maxlength="80" required />
					<button class="mini">Save</button>
				</form>
			{:else}
				<b>{person.name}</b>
				{#if person.kind === 'person'}<button class="mini ghost" type="button" onclick={() => (renaming = true)} aria-label="Rename or remove {person.name}"><Icon name="edit" size={16} /></button>{/if}
			{/if}
			<span class="sub num" class:over>
				{#if person.gifts.length}{person.gifts.length} {person.gifts.length === 1 ? 'gift' : 'gifts'} · {usd(person.plannedCents)}{/if}{#if person.limitCents != null}{person.gifts.length ? ' of ' : ''}{usd(person.limitCents)} budget{#if over}{' · '}over by {usd(person.plannedCents - person.limitCents)}{/if}{/if}
			</span>
			{#if person.limitCents}
				<span class="bar" aria-hidden="true"><i class="plan" style:width="{pct(person.plannedCents)}%"></i><i class="spent" style:width="{pct(person.spentCents)}%"></i></span>
			{/if}
		</div>
		<form method="POST" action="?/limit" use:enhance={keep} class="limit">
			<input type="hidden" name="recipient" value={person.key} />
			<label>
				<span>Budget</span>
				<span class="money"><i>$</i><input class="amt num" name="cents" inputmode="decimal" autocomplete="off" value={centsToInput(person.limitCents)} placeholder="—" onchange={submit} aria-label="Budget for {person.name}" /></span>
			</label>
		</form>
	</header>

	{#if renaming && person.kind === 'person'}
		<form method="POST" action="?/removePerson" use:enhance class="remove" onsubmit={(e) => { if (!confirm(`Remove ${person.name} and their gifts from your budget?`)) e.preventDefault(); }}>
			<input type="hidden" name="id" value={person.key.slice(2)} />
			<button class="mini danger">Remove {person.name}</button>
			<button class="mini ghost" type="button" onclick={() => (renaming = false)}>Cancel</button>
		</form>
	{/if}

	{#each person.gifts as g (g.key)}
		<div class="g" class:removed={g.removed}>
			<form method="POST" action="?/status" use:enhance={keep} class="st">
				<input type="hidden" name="key" value={g.key} />
				<select name="status" class="chip s-{g.status}" value={g.status} onchange={submit} aria-label="Status of {g.title}">
					{#each STATUS_ORDER as s}<option value={s}>{STATUS_LABELS[s]}</option>{/each}
				</select>
			</form>
			<div class="gt">
				{#if g.itemId}<a href="/items/{g.itemId}">{g.title}</a>
				{:else if g.url}<a href={g.url} target="_blank" rel="noopener noreferrer">{g.title}<Icon name="ext" size={14} /></a>
				{:else}<span>{g.title}</span>{/if}
				<span class="meta num">
					{#if g.quantity > 1}{`${g.quantity} × `}{/if}{g.unitCents != null ? usd(g.unitCents) : 'No price'}
					{#if g.source === 'wishbook'}{' · '}Wishbook{/if}{#if shared}{' · '}{g.buyerId === meId ? 'You' : g.buyerName}{/if}
					{#if g.removed}{' · '}<em>Taken off their list</em>{/if}
					{#if g.url && g.itemId}{' · '}<a href={g.url} target="_blank" rel="noopener noreferrer" class="lnk">Link</a>{/if}
				</span>
			</div>
			<form method="POST" action="?/final" use:enhance={keep} class="paid">
				<input type="hidden" name="key" value={g.key} />
				<label>
					<span>Paid</span>
					<span class="money"><i>$</i><input class="amt num" name="final" inputmode="decimal" autocomplete="off"
						value={centsToInput(g.finalCents)}
						placeholder={g.unitCents != null ? centsToInput(g.unitCents * g.quantity) : '—'}
						onchange={submit} aria-label="What you paid for {g.title}, with tax and shipping" /></span>
				</label>
			</form>
			{#if g.source === 'own'}
				<button class="mini ghost ed" type="button" onclick={() => (editing = editing === g.key ? null : g.key)} aria-label="Edit {g.title}" aria-expanded={editing === g.key}><Icon name="edit" size={18} /></button>
			{:else}<span class="ed"></span>{/if}
		</div>
		{#if editing === g.key}
			{@render giftForm('editGift', g)}
		{/if}
	{/each}

	{#if adding}
		{@render giftForm('addGift')}
	{:else}
		<button type="button" class="add" onclick={() => (adding = true)}><Icon name="plus" size={18} />Add a gift for {person.name}</button>
	{/if}
</section>

{#snippet giftForm(action: 'addGift' | 'editGift', g?: BudgetPerson['gifts'][number])}
	<form method="POST" action="?/{action}" class="gform" use:enhance={closeAfter(() => { adding = false; editing = null; })}>
		{#if g}<input type="hidden" name="id" value={g.key.slice(2)} />{:else}<input type="hidden" name="recipient" value={person.key} />{/if}
		<label class="wide"><span>Gift</span><input class="line-in" name="title" required maxlength="200" value={g?.title ?? ''} placeholder="What is it?" /></label>
		<label class="wide"><span>Link</span><input class="line-in" name="url" inputmode="url" value={g?.url ?? ''} placeholder="Optional" /></label>
		<label><span>How many</span><input class="line-in num" name="quantity" type="number" min="1" max="99" value={g?.quantity ?? 1} /></label>
		<label><span>Price each</span><span class="money"><i>$</i><input class="line-in num" name="price" inputmode="decimal" value={centsToInput(g?.unitCents)} placeholder="0.00" /></span></label>
		<label><span>Paid in all</span><span class="money"><i>$</i><input class="line-in num" name="final" inputmode="decimal" value={centsToInput(g?.finalCents)} placeholder="Optional" /></span></label>
		<label><span>Where it is</span>
			<select class="line-in" name="status" value={g?.status ?? 'purchased'}>
				{#each STATUS_ORDER as s}<option value={s}>{STATUS_LABELS[s]}</option>{/each}
			</select>
		</label>
		<div class="acts wide">
			<button class="btn pine">{g ? 'Save' : 'Add gift'}</button>
			<button class="btn ghost" type="button" onclick={() => { adding = false; editing = null; }}>Cancel</button>
		</div>
		{#if g}
			<button class="mini danger wide" formaction="?/deleteGift" formnovalidate onclick={(e) => { if (!confirm(`Delete ${g.title}?`)) e.preventDefault(); }}><Icon name="trash" size={16} />Delete this gift</button>
		{/if}
	</form>
{/snippet}

<style>
	.person { padding: 14px 0 10px; border-bottom: 1px solid var(--rule); }
	header { display: flex; align-items: center; gap: 12px; }
	.who { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; align-items: center; column-gap: 6px; }
	.who b { font-family: var(--display); font-weight: 400; font-size: 19px; line-height: 1.15; }
	.sub { flex-basis: 100%; font-size: 14px; color: var(--muted); font-weight: 700; }
	.sub.over { color: var(--red); }
	.bar { flex-basis: 100%; position: relative; height: 6px; border-radius: 3px; background: var(--wash); margin-top: 5px; overflow: hidden; max-width: 280px; }
	.bar i { position: absolute; inset: 0 auto 0 0; border-radius: 3px; }
	.bar .plan { background: #f3b6c0; }
	.bar .spent { background: var(--red); }
	.rename { display: flex; gap: 6px; align-items: center; flex-basis: 100%; }

	label { display: flex; flex-direction: column; gap: 2px; }
	label > span:first-child { font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
	.money { display: flex; align-items: baseline; gap: 1px; }
	.money i { font-style: normal; color: var(--muted); font-weight: 700; }
	/* Amounts look like text until you touch them. */
	.amt { width: 84px; border: 0; border-bottom: 2px dashed var(--rule); background: transparent; font-weight: 700; font-size: 17px; padding: 4px 0; min-height: 36px; }
	.amt:hover { border-bottom-color: var(--muted); }
	.amt:focus { outline: none; border-bottom: 2px solid var(--red); }
	.amt::placeholder { color: #a9a6a0; font-weight: 400; }
	.limit { flex: none; text-align: right; }
	.limit label { align-items: flex-end; }

	.g { display: grid; grid-template-columns: minmax(0, 1fr) auto 44px; grid-template-areas: 'title title ed' 'st paid ed'; gap: 6px 12px; align-items: center; padding: 12px 0 10px; border-top: 1px dashed var(--rule); margin-top: 10px; }
	.st { grid-area: st; }
	.gt { grid-area: title; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
	.paid { grid-area: paid; }
	.paid label { flex-direction: row; align-items: baseline; gap: 8px; }
	.ed { grid-area: ed; align-self: start; }
	.gt > a, .gt > span:first-child { font-weight: 700; font-size: 16px; line-height: 1.25; color: var(--ink); text-decoration: none; }
	.gt > a:hover { text-decoration: underline; }
	.gt > a :global(svg) { display: inline; vertical-align: -1px; margin-left: 4px; color: var(--muted); }
	.meta { font-size: 14px; color: var(--muted); }
	.meta em { font-style: normal; color: var(--red-deep); font-weight: 700; }
	.lnk { color: var(--muted); }
	.removed .gt > a { text-decoration: line-through; color: var(--muted); }

	.chip { appearance: none; -webkit-appearance: none; border: 0; border-radius: 999px; padding: 6px 28px 6px 12px; font-weight: 700; font-size: 14px; min-height: 36px; cursor: pointer;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%231a1a1a' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
		background-repeat: no-repeat; background-position: right 10px center; }
	.s-claimed { background-color: var(--wash); }
	.s-purchased { background-color: #fdeeb5; }
	.s-shipped { background-color: #dbe8f6; }
	.s-arrived { background-color: #dcefe5; }
	.s-wrapped { background-color: var(--pine); color: #fff; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); }

	.mini { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 36px; min-width: 36px; border-radius: 8px; border: 0; background: var(--ink); color: #fff; font-weight: 700; font-size: 14px; padding: 0 10px; }
	.mini.ghost { background: transparent; color: var(--muted); }
	.mini.ghost:hover { background: var(--wash); color: var(--ink); }
	.mini.danger { background: transparent; color: var(--red); padding: 0 4px; }
	.ed { width: 44px; height: 44px; }
	.remove { display: flex; gap: 8px; margin: 8px 0 0 52px; }

	.add { display: inline-flex; align-items: center; gap: 6px; border: 0; background: none; color: var(--red); font-weight: 700; font-size: 15px; padding: 10px 0; min-height: 44px; margin-top: 4px; }
	.empty .add { margin-top: 0; padding-left: 52px; }

	.gform { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: var(--wash); border-radius: 12px; padding: 14px; margin: 8px 0 6px; }
	.gform .wide { grid-column: 1 / -1; }
	.line-in { border: 0; border-bottom: 2px solid var(--ink); background: transparent; padding: 6px 0; font-size: 16px; min-height: 40px; width: 100%; border-radius: 0; }
	.line-in:focus { outline: none; border-bottom-color: var(--red); }
	.acts { display: flex; gap: 10px; }
	.acts .btn { min-height: 48px; font-size: 16px; }

	@media (min-width: 900px) {
		.g { grid-template-columns: 140px minmax(0, 1fr) 150px 44px; grid-template-areas: 'st title paid ed'; padding: 10px 6px; margin-top: 0; border-top: 0; border-radius: 10px; }
		.g:first-of-type { margin-top: 8px; }
		.g:hover { background: var(--wash); }
		.paid { justify-self: end; }
		.paid label > span:first-child { display: none; }
		.gform { grid-template-columns: 2fr 2fr 1fr 1fr 1.4fr 1.2fr; max-width: 980px; }
		.gform .wide:not(.acts):not(.mini) { grid-column: span 2; }
		.gform .acts { grid-column: 1 / -1; max-width: 360px; }
		.empty .add { padding-left: 52px; }
	}
</style>
