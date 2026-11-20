export const tabs = [
	{ href: '/', label: 'Family', icon: 'book' as const, match: (p: string) => p === '/' || p.startsWith('/people') },
	{ href: '/me/list', label: 'My list', icon: 'star' as const, match: (p: string) => p.startsWith('/me/list') },
	{ href: '/getting', label: "I'm buying", icon: 'gift' as const, match: (p: string) => p.startsWith('/getting') },
	{ href: '/me', label: 'Me', icon: 'user' as const, match: (p: string) => p === '/me' || p.startsWith('/me/archive') || p.startsWith('/admin') }
];
