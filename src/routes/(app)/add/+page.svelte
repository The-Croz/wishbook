<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '$lib/components/Icon.svelte';
	import GiftArt from '$lib/components/GiftArt.svelte';
	import { formatMoney } from '$lib/money';
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';

	type Preview = { status: 'ok' | 'blocked' | 'failed'; url: string; title?: string; imageUrl?: string; store?: string; priceCents?: number; listPriceCents?: number; currency?: string };
	let { data, form } = $props();
	const { item: it, shared, mode } = untrack(() => data);

	let link = $state(it?.url ?? shared ?? '');
	let title = $state(it?.title ?? '');
	let price = $state(it?.priceCents != null ? (it.priceCents / 100).toFixed(2) : '');
	let notes = $state(it?.notes ?? '');
	let priority = $state(it?.priority ?? 'want');
	let preview = $state<Preview | null>(null);
	let loading = $state(false);
	let manual = $state(mode === 'edit');
	let saving = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let lastFetched = '';

	const store = $derived(preview?.store ?? it?.store ?? '');
	const imageUrl = $derived(preview?.imageUrl ?? it?.imageUrl ?? '');
	const scrapeStatus = $derived(preview ? preview.status : (it?.scrapeStatus ?? 'manual'));

	async function fetchPreview(text: string) {
		const t = text.trim();
		if (!t || t === lastFetched || !/https?:\/\/|www\./i.test(t)) return;
		lastFetched = t;
		loading = true;
		try {
			const res = await fetch('/api/preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: t }) });
			const p: Preview = res.ok ? await res.json() : { status: 'failed', url: t };
			preview = p;
			link = p.url;
			if (p.title) title = p.title;
			if (p.priceCents != null) price = (p.priceCents / 100).toFixed(2);
			if (p.status !== 'ok') manual = true;
		} finally {
			loading = false;
		}
	}

	function onLinkInput() {
		clearTimeout(timer);
		timer = setTimeout(() => fetchPreview(link), 400);
	}

	$effect(() => {
		if (data.shared && data.mode === 'add') fetchPreview(data.shared);
	});

	const heading = $derived(data.mode === 'edit' ? 'Edit gift' : data.isMe ? 'Add a gift' : `Add for ${data.ownerName}`);
	const cancelHref = $derived(data.mode === 'edit' && it ? `/items/${it.id}` : data.isMe ? '/me/list' : `/people/${data.ownerId}`);
</script>

<svelte:head><title>{heading} · Wishbook</title></svelte:head>
<svelte:window onkeydown={(e) => { if (e.key === 'Escape') goto(cancelHref); }} />

<div class="scrim">
	<a class="close" href={cancelHref} aria-label="Cancel"><Icon name="back" size={20} />Cancel</a>
	<main class="sheet">
		<div class="grab" aria-hidden="true"></div>
		<h1>{heading}</h1>
		<form method="POST" use:enhance={() => { saving = true; return async ({ update }) => { await update(); saving = false; }; }}>
			<label class="lbl" for="url">Paste a link</label>
			<div class="field linkf" class:ok={preview?.status === 'ok'}>
				<Icon name="link" size={20} />
				<input id="url" name="url" bind:value={link} oninput={onLinkInput} onpaste={(e) => { const t = e.clipboardData?.getData('text'); if (t) { e.preventDefault(); link = t; fetchPreview(t); } }} placeholder="amazon.com/…" inputmode="url" autocomplete="off" autocapitalize="none" />
				{#if loading}<span class="spin" aria-label="Looking up the link"></span>{:else if preview?.status === 'ok'}<span class="okb"><Icon name="ok" size={16} /></span>{/if}
			</div>

			{#if preview?.status === 'blocked'}
				<p class="warn">Amazon didn’t let us peek. Save it anyway and we’ll keep trying in the background — the name, price and picture usually fill in within a day.</p>
			{:else if preview?.status === 'failed'}
				<p class="warn">We couldn’t read that page. Type the name and price below.</p>
			{/if}

			{#if (preview && preview.status === 'ok') || (data.mode === 'edit' && (it?.imageUrl || it?.store))}
				<div class="preview">
					<span class="thumb"><GiftArt src={imageUrl || null} store={store || null} title={title || 'Gift'} height={96} /></span>
					<div>
						{#if store}<p class="no">FOUND ON {store.toUpperCase()}</p>{/if}
						<p class="t">{title || 'Untitled gift'}</p>
						{#if price}<p class="pr num">{formatMoney(Math.round(Number(price) * 100) || 0, preview?.currency ?? it?.currency ?? 'USD')}</p>{/if}
						{#if preview?.status === 'ok'}<p class="small">Price checked just now</p>{/if}
					</div>
				</div>
				{#if !manual}<button type="button" class="link" onclick={() => (manual = true)}>Change the name or price</button>{/if}
			{/if}

			{#if manual || !preview}
				{#if !preview && !manual && data.mode === 'add'}
					<button type="button" class="link" onclick={() => (manual = true)}>No link? Type it in instead</button>
				{:else}
					<label class="lbl" for="title">Name</label>
					<input class="field" id="title" bind:value={title} maxlength="200" placeholder="What is it?" required={!link.trim()} />
					<label class="lbl" for="price">Price <span class="opt">(optional)</span></label>
					<input class="field" id="price" bind:value={price} inputmode="decimal" placeholder="$0.00" />
				{/if}
			{/if}

			<input type="hidden" name="title" value={title} />
			<input type="hidden" name="price" value={price} />
			<input type="hidden" name="store" value={store} />
			<input type="hidden" name="imageUrl" value={imageUrl} />
			<input type="hidden" name="currency" value={preview?.currency ?? it?.currency ?? 'USD'} />
			<input type="hidden" name="listPriceCents" value={preview?.listPriceCents ?? it?.listPriceCents ?? ''} />
			<input type="hidden" name="scrapeStatus" value={scrapeStatus} />

			<label class="lbl" for="notes">Options (size, color, notes)</label>
			<input class="field" id="notes" name="notes" bind:value={notes} maxlength="1000" placeholder="Size M, any color but orange" />

			<fieldset>
				<legend class="lbl">How much {data.isMe ? 'do you' : `does ${data.ownerName}`} want it?</legend>
				<div class="seg">
					{#each [['nice', 'Nice to have'], ['want', 'Want'], ['most', 'Most wanted']] as [v, l]}
						<label class:on={priority === v}><input type="radio" name="priority" value={v} bind:group={priority} />{l}</label>
					{/each}
				</div>
			</fieldset>

			{#if form?.message}<p class="err" role="alert">{form.message}</p>{/if}
			<button class="btn" disabled={saving || loading || (!title.trim() && !link.trim())}>
				{saving ? 'Saving…' : data.mode === 'edit' ? 'Save changes' : data.isMe ? 'Add to my list' : `Add to ${data.ownerName}’s list`}
			</button>
		</form>
	</main>
</div>

<style>
	.scrim { min-height: 100dvh; background: var(--red); display: flex; flex-direction: column; padding-top: calc(env(safe-area-inset-top) + 8px); }
	.close { color: #fff; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; padding: 10px 16px; min-height: 44px; text-decoration: none; max-width: 640px; width: 100%; margin: 0 auto; }
	.sheet { flex: 1; background: #fff; border-radius: 22px 22px 0 0; padding: 10px 20px calc(var(--tabbar) + 40px); max-width: 640px; width: 100%; margin: 0 auto; }
	.grab { width: 40px; height: 5px; border-radius: 3px; background: var(--rule); margin: 0 auto 14px; }
	h1 { font-family: var(--display); font-weight: 400; font-size: 26px; }
	.linkf { display: flex; align-items: center; gap: 8px; padding: 0 12px; color: var(--muted); }
	.linkf.ok { border-color: var(--pine); }
	.linkf input { border: 0; outline: none; flex: 1; min-width: 0; font-size: 16px; padding: 12px 0; color: var(--ink); background: transparent; }
	.okb { width: 22px; height: 22px; border-radius: 50%; background: var(--pine); color: #fff; display: flex; align-items: center; justify-content: center; flex: none; }
	.spin { width: 18px; height: 18px; border: 3px solid var(--rule); border-top-color: var(--red); border-radius: 50%; animation: spin 0.8s linear infinite; flex: none; }
	@keyframes spin { to { transform: rotate(360deg); } }
	.warn { background: #fff7d6; border-radius: 10px; padding: 10px 12px; font-size: 15px; margin-top: 10px; }
	.preview { display: flex; gap: 12px; border: 2px solid var(--rule); border-radius: 12px; padding: 12px; margin-top: 14px; }
	.thumb { width: 96px; flex: none; }
	.no { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; color: var(--muted); }
	.t { font-weight: 700; font-size: 15px; line-height: 1.25; }
	.pr { font-family: var(--display); font-size: 21px; color: var(--red); margin-top: 4px; }
	.small { font-size: 13px; color: var(--muted); }
	.opt { font-weight: 400; color: var(--muted); }
	.link { background: none; border: 0; padding: 0; color: var(--red); font-weight: 700; text-decoration: underline; text-underline-offset: 3px; min-height: 44px; margin-top: 6px; }
	fieldset { border: 0; padding: 0; margin: 0; }
	.seg { display: flex; border: 2px solid var(--ink); border-radius: 10px; overflow: hidden; }
	.seg label { flex: 1; text-align: center; padding: 12px 2px; font-weight: 700; font-size: 14px; cursor: pointer; min-height: 48px; display: flex; align-items: center; justify-content: center; }
	.seg label.on { background: var(--ink); color: #fff; }
	.seg input { position: absolute; opacity: 0; pointer-events: none; }
	.seg label:has(input:focus-visible) { outline: 3px solid var(--mustard); outline-offset: -3px; }
	.btn { margin-top: 20px; }
	@media (min-width: 900px) {
		.scrim { min-height: 0; background: transparent; padding: 30px 44px 64px; }
		.close { color: var(--ink); padding: 0; margin: 0 0 12px; max-width: 640px; }
		.sheet { flex: none; border: 2px solid var(--ink); border-radius: 20px; box-shadow: 0 6px 0 var(--ink); padding: 26px 30px 28px; max-width: 640px; margin: 0; }
		.grab { display: none; }
	}
</style>
