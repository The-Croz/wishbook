<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '$lib/components/Icon.svelte';
	let { data, form } = $props();
	const adults = $derived(data.people.filter((p) => !p.isManaged));
	const kids = $derived(data.people.filter((p) => p.isManaged));
	let open = $state<string | null>(null);
	const toggle = (k: string) => (open = open === k ? null : k);
	const msg = (k: string) => (form?.form === k ? form : null);
</script>

<svelte:head><title>People · Wishbook</title></svelte:head>

<header class="hdr">
	<a class="back" href="/me"><Icon name="back" size={20} />Me</a>
	<h1>People and kids</h1>
	<p class="meta">{adults.length} {adults.length === 1 ? 'person' : 'people'} · {kids.length} {kids.length === 1 ? 'kid' : 'kids'}</p>
</header>

<main class="pg">
	<div class="secthd"><b>People who sign in</b></div>
	{#each adults as p (p.id)}
		<div class="person" class:off={!p.isActive}>
			<button class="head" onclick={() => toggle(`p${p.id}`)} aria-expanded={open === `p${p.id}`}>
				<span class="dot" style:background={p.avatarColor}></span>
				<span class="nm">{p.displayName}{#if p.isAdmin}<span class="tag">ADMIN</span>{/if}{#if !p.isActive}<span class="tag gray">OFF</span>{/if}</span>
				<span class="un">{p.username}</span>
			</button>
			{#if open === `p${p.id}`}
				<div class="body">
					<form method="POST" action="?/reset" use:enhance>
						<input type="hidden" name="userId" value={p.id} />
						<label class="lbl" for="pw{p.id}">New password for {p.displayName}</label>
						<div class="inline"><input class="field" id="pw{p.id}" name="password" type="text" autocomplete="off" minlength="8" required /><button class="btn ink sm">Reset</button></div>
						{#if msg(`reset-${p.id}`)}<p class={msg(`reset-${p.id}`)?.message ? 'err' : 'ok'}>{msg(`reset-${p.id}`)?.message ?? msg(`reset-${p.id}`)?.done}</p>{/if}
					</form>
					{#if p.id !== data.me.id}
						<form method="POST" action="?/active" use:enhance>
							<input type="hidden" name="userId" value={p.id} /><input type="hidden" name="active" value={p.isActive ? 'no' : 'yes'} />
							<button class="btn {p.isActive ? 'danger' : 'ghost'}">{p.isActive ? 'Turn off this account' : 'Turn this account back on'}</button>
						</form>
					{/if}
				</div>
			{/if}
		</div>
	{/each}

	<button class="btn ghost add" onclick={() => toggle('newp')}><Icon name="plus" size={18} />Add a person</button>
	{#if open === 'newp' || msg('person')}
		<form method="POST" action="?/addPerson" use:enhance class="card">
			<label class="lbl" for="dn">Name everyone sees</label><input class="field" id="dn" name="displayName" placeholder="Grandma June" required />
			<label class="lbl" for="un">Username</label><input class="field" id="un" name="username" autocapitalize="none" placeholder="june" required />
			<label class="lbl" for="pw">Starting password</label><input class="field" id="pw" name="password" type="text" autocomplete="off" minlength="8" required />
			<label class="check"><input type="checkbox" name="isAdmin" /> Also an admin</label>
			{#if msg('person')}<p class={msg('person')?.message ? 'err' : 'ok'}>{msg('person')?.message ?? msg('person')?.done}</p>{/if}
			<button class="btn">Add person</button>
		</form>
	{/if}

	<div class="secthd sp"><b>Kids (no login)</b></div>
	{#each kids as k (k.id)}
		<div class="person">
			<button class="head" onclick={() => toggle(`k${k.id}`)} aria-expanded={open === `k${k.id}`}>
				<span class="dot" style:background={k.avatarColor}></span>
				<span class="nm">{k.displayName}</span>
				<span class="un">{k.managerIds.map((id) => data.people.find((p) => p.id === id)?.displayName).join(', ')}</span>
			</button>
			{#if open === `k${k.id}`}
				<form method="POST" action="?/managers" use:enhance class="body">
					<input type="hidden" name="kidId" value={k.id} />
					<p class="lbl">Who manages {k.displayName}’s list?</p>
					{#each adults.filter((a) => a.isActive) as a (a.id)}
						<label class="check"><input type="checkbox" name="managers" value={a.id} checked={k.managerIds.includes(a.id)} /> {a.displayName}</label>
					{/each}
					{#if msg('managers')}<p class={msg('managers')?.message ? 'err' : 'ok'}>{msg('managers')?.message ?? msg('managers')?.done}</p>{/if}
					<button class="btn ink">Save</button>
				</form>
			{/if}
		</div>
	{:else}
		<p class="muted">No kids yet.</p>
	{/each}

	<button class="btn ghost add" onclick={() => toggle('newk')}><Icon name="plus" size={18} />Add a kid</button>
	{#if open === 'newk' || msg('kid')}
		<form method="POST" action="?/addKid" use:enhance class="card">
			<label class="lbl" for="kn">Kid’s name</label><input class="field" id="kn" name="displayName" placeholder="Milo" required />
			<p class="lbl">Who manages the list?</p>
			{#each adults.filter((a) => a.isActive) as a (a.id)}
				<label class="check"><input type="checkbox" name="managers" value={a.id} checked={a.id === data.me.id} /> {a.displayName}</label>
			{/each}
			{#if msg('kid')}<p class={msg('kid')?.message ? 'err' : 'ok'}>{msg('kid')?.message ?? msg('kid')?.done}</p>{/if}
			<button class="btn">Add kid</button>
		</form>
	{/if}
</main>

<style>
	.back { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; color: #fff; text-decoration: none; min-height: 44px; }
	.sp { margin-top: 30px; }
	.person { border-bottom: 1px solid var(--rule); }
	.person.off .nm { color: var(--muted); }
	.head { width: 100%; display: flex; align-items: center; gap: 12px; background: none; border: 0; padding: 12px 0; min-height: 60px; text-align: left; }
	.dot { width: 28px; height: 28px; border-radius: 50%; flex: none; }
	.nm { font-weight: 700; font-size: 17px; flex: 1; }
	.un { color: var(--muted); font-size: 14px; }
	.tag { font-size: 12px; font-weight: 700; letter-spacing: 0.06em; background: var(--mustard); padding: 2px 6px; border-radius: 4px; margin-left: 6px; vertical-align: 2px; }
	.tag.gray { background: var(--rule); }
	.body { padding: 0 0 16px; display: flex; flex-direction: column; gap: 10px; }
	.inline { display: flex; gap: 8px; }
	.btn.sm { width: auto; min-height: 50px; font-size: 16px; }
	.add { margin-top: 14px; }
	.card { background: var(--wash); border-radius: 12px; padding: 4px 14px 14px; margin-top: 10px; display: flex; flex-direction: column; }
	.card .btn { margin-top: 14px; }
	.check { display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: 16px; }
	.check input { width: 22px; height: 22px; accent-color: var(--red); }
	.ok { color: var(--pine); font-weight: 700; }
	.muted { color: var(--muted); }
</style>
