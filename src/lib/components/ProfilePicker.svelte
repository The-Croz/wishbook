<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { AVATAR_COLORS, shrinkPhoto } from '$lib/avatar';
	import Avatar from './Avatar.svelte';
	let { userId, name, color, photo }: { userId: number; name: string; color: string; photo: string | null } = $props();
	let busy = $state(false);
	let problem = $state('');
	let fileInput: HTMLInputElement;
	// Shows the new color right away while the save is in flight.
	let picked = $state<string | null>(null);
	const shown = $derived(picked ?? color);

	async function send(body: FormData) {
		busy = true;
		problem = '';
		body.set('userId', String(userId));
		try {
			const res = await fetch('/api/avatar', { method: 'POST', body });
			if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? 'That didn’t save. Try again.');
			await invalidateAll();
		} catch (e) {
			problem = (e as Error).message;
		} finally {
			busy = false;
			picked = null;
		}
	}

	function pickColor(c: string) {
		picked = c;
		const f = new FormData();
		f.set('color', c);
		send(f);
	}

	async function pickPhoto(e: Event & { currentTarget: HTMLInputElement }) {
		const file = e.currentTarget.files?.[0];
		e.currentTarget.value = '';
		if (!file) return;
		let blob: Blob;
		try {
			blob = await shrinkPhoto(file);
		} catch {
			problem = 'Couldn’t read that photo. Try a JPEG or PNG.';
			return;
		}
		const f = new FormData();
		f.set('photo', blob, 'photo.jpg');
		send(f);
	}

	function removePhoto() {
		const f = new FormData();
		f.set('remove', '1');
		send(f);
	}
</script>

<div class="pp" aria-busy={busy}>
	<div class="row">
		<Avatar {name} color={shown} {photo} size={72} display />
		<div class="acts">
			<button type="button" class="btn ghost sm" disabled={busy} onclick={() => fileInput.click()}>{photo ? 'Change photo' : 'Upload a photo'}</button>
			{#if photo}<button type="button" class="link" disabled={busy} onclick={removePhoto}>Remove photo</button>{/if}
			<input bind:this={fileInput} type="file" accept="image/*" hidden onchange={pickPhoto} />
		</div>
	</div>
	<p class="lbl">{photo ? 'Color (shows behind the photo while it loads)' : 'Color'}</p>
	<div class="sw" role="radiogroup" aria-label="Profile color for {name}">
		{#each AVATAR_COLORS as c (c)}
			<button type="button" role="radio" aria-checked={shown.toUpperCase() === c} aria-label={c} class:on={shown.toUpperCase() === c} style:background={c} disabled={busy} onclick={() => pickColor(c)}></button>
		{/each}
	</div>
	{#if problem}<p class="err" role="alert">{problem}</p>{/if}
</div>

<style>
	.pp { margin-top: 10px; }
	.row { display: flex; align-items: center; gap: 16px; }
	.acts { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
	.link { background: none; border: 0; padding: 4px 0; color: var(--red); font-weight: 700; text-decoration: underline; text-underline-offset: 3px; font-size: 15px; }
	.lbl { margin-top: 16px; }
	.sw { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; }
	.sw button { width: 40px; height: 40px; border-radius: 50%; border: 2px solid var(--rule); padding: 0; cursor: pointer; }
	.sw button.on { border-color: var(--ink); box-shadow: 0 0 0 3px #fff inset; }
	.sw button:disabled { cursor: progress; }
</style>
