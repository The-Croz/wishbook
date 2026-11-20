/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `wishbook-${version}`;
// App code, fonts, icons, brand art, and the offline page. Never pages or API responses (they carry list data).
const ASSETS = [...build, ...files.filter((f) => f !== '/manifest.webmanifest')];

sw.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => sw.skipWaiting()));
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;
	const url = new URL(req.url);
	if (url.origin !== sw.location.origin) return;
	if (ASSETS.includes(url.pathname)) {
		event.respondWith(caches.match(url.pathname).then((hit) => hit ?? fetch(req)));
		return;
	}
	if (req.mode === 'navigate') {
		event.respondWith(fetch(req).catch(async () => (await caches.match('/offline.html')) ?? Response.error()));
	}
});
