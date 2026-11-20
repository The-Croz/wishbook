<script lang="ts">
	import TabBar from '$lib/components/TabBar.svelte';
	let { children } = $props();
</script>

<div class="shell">{@render children()}</div>
<TabBar />
