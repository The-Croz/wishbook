<script lang="ts">
	type Name = 'book' | 'star' | 'gift' | 'user' | 'plus' | 'chev' | 'back' | 'eye' | 'link' | 'ok' | 'clock' | 'edit' | 'trash' | 'ext';
	let { name, size = 24 }: { name: Name; size?: number } = $props();
	const P: Record<Name, string> = {
		book: 'M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 21V5M8 7h7',
		star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
		gift: 'M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8C10 4 6 4 7 7c.5 1 3 1 5 1zm0 0c2-4 6-4 5-1-.5 1-3 1-5 1z',
		user: 'M8 8a4 4 0 108 0 4 4 0 10-8 0M4 21c1-4 4-6 8-6s7 2 8 6',
		plus: 'M12 5v14M5 12h14',
		chev: 'M9 6l6 6-6 6',
		back: 'M15 6l-6 6 6 6',
		eye: 'M3 3l18 18M10.6 6.1A10 10 0 0112 6c5 0 9 4 10 6-.4.9-1.3 2.2-2.6 3.4M6.6 6.6C4.4 8 2.8 10.2 2 12c1 2 5 6 10 6 1.8 0 3.4-.5 4.8-1.3M9.9 9.9a3 3 0 004.2 4.2',
		link: 'M10 14a4 4 0 006 0l3-3a4 4 0 00-6-6l-1 1M14 10a4 4 0 00-6 0l-3 3a4 4 0 006 6l1-1',
		ok: 'M5 12l5 5 9-10',
		clock: 'M3 12a9 9 0 1018 0 9 9 0 10-18 0M12 7v5l3 2',
		edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
		trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
		ext: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6'
	};
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={P[name]} /></svg>
