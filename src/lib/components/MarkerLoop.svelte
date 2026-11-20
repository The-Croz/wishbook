<svg class="loop" viewBox="0 0 180 160" preserveAspectRatio="none" aria-hidden="true">
	<path d="M30 70C34 30 70 10 104 12c42 3 66 30 64 68-2 40-34 68-80 66C42 144 10 118 14 78c3-26 22-44 52-52" fill="none" stroke="#C8102E" stroke-width="5" stroke-linecap="round" vector-effect="non-scaling-stroke" pathLength="1" />
</svg>

<style>
	.loop { position: absolute; inset: -10px -8px auto -8px; width: calc(100% + 16px); height: 160px; pointer-events: none; }
	.loop path { stroke-width: 4; stroke-dasharray: 1; stroke-dashoffset: 0; animation: draw 0.7s cubic-bezier(0.16, 1, 0.3, 1); }
	@keyframes draw { from { stroke-dashoffset: 1; } }
	@media (prefers-reduced-motion: reduce) { .loop path { animation: none; } }
</style>
