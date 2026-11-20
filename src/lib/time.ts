/** "just now", "5 minutes ago", "2 hours ago", "3 days ago". */
export function timeAgo(ms: number, now = Date.now()): string {
	const s = Math.max(0, Math.round((now - ms) / 1000));
	if (s < 60) return 'just now';
	const units: [number, string][] = [[86400, 'day'], [3600, 'hour'], [60, 'minute']];
	for (const [size, name] of units) {
		const n = Math.floor(s / size);
		if (n >= 1) return `${n} ${name}${n === 1 ? '' : 's'} ago`;
	}
	return 'just now';
}
