<script lang="ts">
	import TabBar from '$lib/components/TabBar.svelte';
	import AppPrompts from '$lib/components/AppPrompts.svelte';
	let { data, children } = $props();
</script>

<div class="shell">{@render children()}</div>
<AppPrompts vapidKey={data.vapidKey} />
<TabBar />
