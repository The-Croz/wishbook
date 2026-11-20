<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '$lib/components/Icon.svelte';
	import GiftArt from '$lib/components/GiftArt.svelte';
	import { formatMoney } from '$lib/money';
	let { data, form } = $props();
	let busy = $state(false);
	const submit = () => { busy = true; return async ({ update }: { update: () => Promise<void> }) => { await update(); busy = false; }; };
	const rows = $derived(form && 'rows' in form ? form.rows : null);
	const ownerName = $derived(data.people.find((p) => p.id === (form as { ownerId?: number } | null)?.ownerId)?.displayName ?? '');
</script>

<svelte:head><title>Import from Elfster · Wishbook</title></svelte:head>

<header class="hdr">
	<a class="back" href="/me"><Icon name="back" size={20} />Me</a>
	<h1>Import from Elfster</h1>
	<p class="meta">One list at a time</p>
</header>

<main class="pg">
	{#if form && 'done' in form && form.done}
		<p class="note">Added {form.done.added} {form.done.added === 1 ? 'gift' : 'gifts'} to {ownerName}’s list{form.done.skipped ? `, skipped ${form.done.skipped} already there` : ''}. Prices update tonight.</p>
		<a class="btn ink" href="/people/{form.ownerId}">See {ownerName}’s list</a>
		<a class="btn ghost" style="margin-top:10px" href="/admin/import">Import another list</a>
	{:else if rows}
		<form method="POST" action="?/import" use:enhance={submit}>
			<input type="hidden" name="link" value={form?.link} />
			<input type="hidden" name="ownerId" value={(form as { ownerId: number }).ownerId} />
			<div class="secthd"><b>{rows.length} gifts for {ownerName}</b><span>Untick any to skip</span></div>
			{#each rows as r (r.key)}
				<label class="row">
					<input type="checkbox" name="keep" value={r.key} checked={r.selected} />
					<span class="thumb"><GiftArt src={r.imageUrl} store={r.store} title={r.title} height={56} /></span>
					<span class="body">
						<span class="t">{r.title}</span>
						<span class="sm">{r.store ?? 'No link'}{r.priceCents != null ? ` · ${formatMoney(r.priceCents, r.currency)}` : ''}{r.priority === 'most' ? ' · Most wanted' : ''}{r.reason ? ` · ${r.reason}` : ''}</span>
					</span>
				</label>
			{/each}
			<button class="btn" disabled={busy}>{busy ? 'Importing…' : `Import to ${ownerName}’s list`}</button>
		</form>
	{:else}
		<p class="note">On Elfster, open the wish list, copy the address from the browser (it has “wish-lists” in it), and paste it here. The list has to be public.</p>
		<form method="POST" action="?/preview" use:enhance={submit}>
			<label class="lbl" for="owner">Whose list is it?</label>
			<select class="field" id="owner" name="ownerId" required>
				<option value="">Pick a person</option>
				{#each data.people as p (p.id)}<option value={p.id} selected={form?.ownerId === p.id}>{p.displayName}{p.isManaged ? ' (kid)' : ''}</option>{/each}
			</select>
			<label class="lbl" for="link">Elfster wish list link</label>
			<input class="field" id="link" name="link" value={form?.link ?? ''} placeholder="https://www.elfster.com/profile/…/wish-lists/…" autocapitalize="none" required />
			{#if form?.message}<p class="err" role="alert">{form.message}</p>{/if}
			<button class="btn ink" style="margin-top:18px" disabled={busy}>{busy ? 'Reading the list…' : 'Look at the list'}</button>
		</form>
	{/if}
</main>

<style>
	.back { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; color: #fff; text-decoration: none; min-height: 44px; }
	.row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--rule); cursor: pointer; }
	.row input { width: 24px; height: 24px; accent-color: var(--red); flex: none; }
	.thumb { width: 56px; flex: none; }
	.body { display: flex; flex-direction: column; min-width: 0; }
	.t { font-weight: 700; font-size: 15px; line-height: 1.2; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
	.sm { font-size: 14px; color: var(--muted); }
	form > .btn { margin-top: 20px; position: sticky; bottom: calc(var(--tabbar) + 12px + env(safe-area-inset-bottom)); }
	select.field { appearance: auto; }
</style>
