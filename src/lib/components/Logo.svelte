<script lang="ts">
	let { onRed = false, width = 300 }: { onRed?: boolean; width?: number } = $props();
</script>

<img src={onRed ? '/brand/logo-on-red.svg' : '/brand/logo.svg'} alt="Crosby Family" {width} height={Math.round((width * 210) / 310)} />
