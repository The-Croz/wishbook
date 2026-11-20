/** Who may reach a path. Form actions run before layout loads, so this runs in the hook for every request. */
export function routeGuard(pathname: string, user: { isAdmin: boolean } | null): 'ok' | 'login' | 'forbidden' {
	const open =
		pathname === '/login' || pathname === '/api/health' || pathname === '/offline.html' || pathname === '/service-worker.js' ||
		pathname === '/manifest.webmanifest' || pathname === '/favicon.svg' ||
		/^\/(_app|brand|icons)\//.test(pathname);
	if (open) return 'ok';
	if (!user) return 'login';
	if ((pathname === '/admin' || pathname.startsWith('/admin/')) && !user.isAdmin) return 'forbidden';
	return 'ok';
}

/** Only same-site paths after login. */
export function safeNext(next: string | null, origin: string): string {
	if (!next || !next.startsWith('/') || next.startsWith('//') || /\\|%5c/i.test(next)) return '/';
	try {
		const u = new URL(next, origin);
		return u.origin === new URL(origin).origin ? u.pathname + u.search : '/';
	} catch {
		return '/';
	}
}
