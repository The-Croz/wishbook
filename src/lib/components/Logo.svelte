<script lang="ts">
	let { onRed = false, width = 300 }: { onRed?: boolean; width?: number } = $props();
</script>

<svg {width} height={(width * 210) / 310} viewBox="0 0 310 210" role="img" aria-label="Crosby Family">
	<rect x="16" y="130" width="90" height="62" fill="#2E7D5B" /><rect x="56" y="130" width="10" height="62" fill="#F2B705" />
	<rect x="28" y="84" width="66" height="46" fill={onRed ? '#fff' : '#C8102E'} /><rect x="56" y="84" width="10" height="46" fill={onRed ? '#C8102E' : '#fff'} />
	<rect x="40" y="50" width="42" height="34" fill="#F2B705" /><rect x="56" y="50" width="10" height="34" fill="#C8102E" />
	<path d="M61 50c-8-16-22-13-19-5 2 5 11 5 19 5zM61 50c8-16 22-13 19-5-2 5-11 5-19 5z" fill={onRed ? '#fff' : '#C8102E'} />
	<text x="120" y="122" font-family="Archivo Black" font-size="46" fill={onRed ? '#fff' : '#1A1A1A'} letter-spacing="-1">Crosby</text>
	<text x="121" y="164" font-family="Archivo Black" font-size="34" fill={onRed ? '#F2B705' : '#C8102E'} letter-spacing=".5">Family</text>
</svg>
