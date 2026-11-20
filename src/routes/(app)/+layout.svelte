<script lang="ts">
	import TabBar from '$lib/components/TabBar.svelte';
	import Rail from '$lib/components/Rail.svelte';
	import AppPrompts from '$lib/components/AppPrompts.svelte';
	let { data, children } = $props();
</script>

<div class="frame">
	<Rail me={data.me} countdown={data.countdown} />
	<div class="stage"><div class="shell">{@render children()}</div></div>
</div>
<AppPrompts vapidKey={data.vapidKey} />
<TabBar />
