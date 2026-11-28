<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { BudgetGift } from '$lib/server/budget';
	import { STATUS_LABELS, STATUS_ORDER } from '$lib/giftStatus';
	import { centsToInput, formatMoney } from '$lib/money';
	import Icon from './Icon.svelte';

	/**
	 * One gift on the Budget page: status, name and details, and what was paid.
	 * `forName` shows who it's for, used when gifts are grouped by stage instead of by person.
	 */
	let { g, shared, meId, forName, forHref, editing = false, onedit }: {
		g: BudgetGift; shared: boolean; meId: number;
		forName?: string; forHref?: string; editing?: boolean; onedit?: () => void;
	} = $props();

	const keep: SubmitFunction = () => async ({ update }) => update({ reset: false });
	const submit = (e: Event) => (e.currentTarget as HTMLInputElement | HTMLSelectElement).form?.requestSubmit();
	const usd = (c: number) => formatMoney(c, 'USD');
</script>

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
			{#if forName}For {#if forHref}<a class="for" href={forHref}>{forName}</a>{:else}<b class="for">{forName}</b>{/if}{' · '}{/if}{#if g.quantity > 1}{`${g.quantity} × `}{/if}{g.unitCents != null ? usd(g.unitCents) : 'No price'}
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
	{#if onedit}
		<button class="ed" type="button" onclick={onedit} aria-label="Edit {g.title}" aria-expanded={editing}><Icon name="edit" size={18} /></button>
	{:else}<span class="ed"></span>{/if}
</div>

<style>
	.g { display: grid; grid-template-columns: minmax(0, 1fr) auto 44px; grid-template-areas: 'title title ed' 'st paid ed'; gap: 6px 12px; align-items: center; padding: 12px 0 10px; border-top: 1px dashed var(--rule); margin-top: 10px; }
	.st { grid-area: st; }
	.gt { grid-area: title; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
	.paid { grid-area: paid; }
	.ed { grid-area: ed; align-self: start; width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 8px; background: transparent; color: var(--muted); }
	button.ed:hover { background: var(--wash); color: var(--ink); }
	.gt > a, .gt > span:first-child { font-weight: 700; font-size: 16px; line-height: 1.25; color: var(--ink); text-decoration: none; }
	.gt > a:hover { text-decoration: underline; }
	.gt > a :global(svg) { display: inline; vertical-align: -1px; margin-left: 4px; color: var(--muted); }
	.meta { font-size: 14px; color: var(--muted); }
	.meta em { font-style: normal; color: var(--red-deep); font-weight: 700; }
	.for { color: var(--ink); font-weight: 700; }
	.lnk { color: var(--muted); }
	.removed .gt > a { text-decoration: line-through; color: var(--muted); }

	label { display: flex; flex-direction: row; align-items: baseline; gap: 8px; }
	label > span:first-child { font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
	.money { display: flex; align-items: baseline; gap: 1px; }
	.money i { font-style: normal; color: var(--muted); font-weight: 700; }
	/* Amounts look like text until you touch them. */
	.amt { width: 84px; border: 0; border-bottom: 2px dashed var(--rule); background: transparent; font-weight: 700; font-size: 17px; padding: 4px 0; min-height: 36px; }
	.amt:hover { border-bottom-color: var(--muted); }
	.amt:focus { outline: none; border-bottom: 2px solid var(--red); }
	.amt::placeholder { color: #a9a6a0; font-weight: 400; }

	.chip { appearance: none; -webkit-appearance: none; border: 0; border-radius: 999px; padding: 6px 28px 6px 12px; font-weight: 700; font-size: 14px; min-height: 36px; cursor: pointer;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%231a1a1a' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
		background-repeat: no-repeat; background-position: right 10px center; }
	.s-claimed { background-color: var(--wash); }
	.s-purchased { background-color: #fdeeb5; }
	.s-shipped { background-color: #dbe8f6; }
	.s-arrived { background-color: #dcefe5; }
	.s-wrapped { background-color: var(--pine); color: #fff; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); }

	@media (min-width: 900px) {
		.g { grid-template-columns: 140px minmax(0, 1fr) 150px 44px; grid-template-areas: 'st title paid ed'; padding: 10px 6px; margin-top: 0; border-top: 0; border-radius: 10px; }
		.g:hover { background: var(--wash); }
		.paid { justify-self: end; }
		.paid label > span:first-child { display: none; }
	}
</style>
