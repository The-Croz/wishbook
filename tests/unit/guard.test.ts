import { describe, expect, it } from 'vitest';
import { routeGuard, safeNext } from '../../src/lib/server/guard';

const user = { isAdmin: false } as never, admin = { isAdmin: true } as never;
describe('routeGuard', () => {
	it('lets anyone reach login, health, and assets', () => {
		for (const p of ['/login', '/api/health', '/manifest.webmanifest', '/_app/x.js', '/brand/logo.svg', '/icons/icon-192.png', '/offline.html', '/favicon.svg', '/service-worker.js'])
			expect(routeGuard(p, null)).toBe('ok');
	});
	it('stops logged-out requests everywhere else, including actions', () => {
		expect(routeGuard('/admin/prices', null)).toBe('login');
		expect(routeGuard('/items/3', null)).toBe('login');
		expect(routeGuard('/api/preview', null)).toBe('login');
	});
	it('keeps non-admins out of admin', () => {
		expect(routeGuard('/admin/import', user)).toBe('forbidden');
		expect(routeGuard('/admin/import', admin)).toBe('ok');
		expect(routeGuard('/admin', user)).toBe('forbidden');
	});
});

describe('safeNext', () => {
	it('allows same-site paths', () => expect(safeNext('/people/3', 'https://w.example')).toBe('/people/3'));
	it('blocks other sites', () => {
		for (const n of ['//evil.com', '/\\evil.com', 'https://evil.com', '/%5Cevil.com']) expect(safeNext(n, 'https://w.example')).toBe('/');
	});
});
