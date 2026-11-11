/* HSK4 Chinese lab — scoped offline support. Network-first keeps course data fresh. */
const CACHE_NAME = 'hsk4-chinese-lab-pwa-v7';
const CORE_URLS = [
  "/chinese/",
  "/chinese/index.html",
  "/chinese/manifest.webmanifest",
  "/chinese/icons/duck.svg",
  "/chinese/icons/icon-192.png",
  "/chinese/icons/icon-512.png",
  "/chinese/css/review-session.css?v=20261110-1",
  "/chinese/js/review-fsrs.js?v=20261110-1",
  "/chinese/css/writing.css?v=20261111-5",
  "/chinese/js/writing-guide-ru.js?v=20261111-1",
  "/chinese/js/writing.js?v=20261111-5",
  "/chinese/js/progress-store.js",
  "/chinese/js/streak.js?v=20261110-1",
  "/chinese/config/supabase.js",
  "/chinese/js/google-auth.js",
  "/chinese/js/pinyin-chars.js",
  "/chinese/js/sentence-tiles.js",
  "/chinese/js/exercise-sessions.js",
  "/chinese/js/quest-mnemonics.js?v=20261109-2",
  "/chinese/js/quest-roleplay.js?v=20261110-4",
  "/chinese/js/quest-roleplay-extended.js?v=20261110-3",
  "/chinese/js/quest-roleplay-remaining.js?v=20261110-2",
  "/chinese/js/quest-roleplay-view.js?v=20261110-4",
  "/chinese/js/quest-lesson3.js?v=20261110-1",
  "/chinese/js/quest-lesson4.js?v=20261110-2",
  "/chinese/js/quest-lesson5.js?v=20261110-1",
  "/chinese/js/quest-lesson6.js?v=20261110-1",
  "/chinese/js/quest-lessons7-10.js?v=20261110-3",
  "/chinese/js/quest-branches.js?v=20261110-4",
  "/chinese/data/manifest.json",
  "/chinese/data/character-components.json",
  "/chinese/data/lesson1.json",
  "/chinese/data/lesson2.json",
  "/chinese/data/lesson3.json",
  "/chinese/data/lesson4.json",
  "/chinese/data/lesson5.json",
  "/chinese/data/lesson6.json",
  "/chinese/data/lesson7.json",
  "/chinese/data/lesson8.json",
  "/chinese/data/lesson9.json",
  "/chinese/data/lesson10.json",
  "/chinese/data/extra-words.json",
  "/chinese/data/readings.json",
  "/chinese/data/context-glossary.json"
];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(CORE_URLS.map(url => cache.add(new Request(url, {cache:'reload'}))));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('hsk4-chinese-lab-pwa-') && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/chinese/')) return;
  // Authentication redirects may contain private one-use tokens: never cache them.
  if (url.searchParams.has('code') || url.searchParams.has('access_token') || url.searchParams.has('error')) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        event.waitUntil(cache.put(request, response.clone()));
      }
      return response;
    } catch (error) {
      const saved = await cache.match(request);
      if (saved) return saved;
      if (request.mode === 'navigate') {
        const home = await cache.match('/chinese/') || await cache.match('/chinese/index.html');
        if (home) return home;
      }
      throw error;
    }
  })());
});
