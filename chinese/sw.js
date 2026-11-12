/* HSK4 Chinese lab — scoped offline support. Network-first keeps course data fresh. */
const CACHE_NAME = 'hsk4-chinese-lab-pwa-v29';
const CORE_URLS = [
  "/chinese/",
  "/chinese/index.html",
  "/chinese/manifest.webmanifest",
  "/chinese/icons/duck.svg",
  "/chinese/icons/icon-192.png",
  "/chinese/icons/icon-512.png",
  "/chinese/css/review-session.css?v=20261110-1",
  "/chinese/js/review-fsrs.js?v=20261110-1",
  "/chinese/css/writing.css?v=20261111-8",
  "/chinese/css/scene-match.css?v=20261111-2",
  "/chinese/css/learning-path.css?v=20261112-1",
  "/chinese/css/sentence-coach.css?v=20261112-1",
  "/chinese/js/writing-guide-ru.js?v=20261111-4",
  "/chinese/js/writing.js?v=20261111-5",
  "/chinese/js/scene-match.js?v=20261112-1",
  "/chinese/js/learning-path.js?v=20261112-1",
  "/chinese/js/hsk3-base.js?v=20261112-1",
  "/chinese/js/sentence-coach.js?v=20261112-1",
  "/chinese/js/offline-bundle.js",
  "/chinese/js/progress-store.js",
  "/chinese/js/streak.js?v=20261110-1",
  "/chinese/config/supabase.js",
  "/chinese/js/google-auth.js",
  "/chinese/js/pinyin-chars.js",
  "/chinese/js/sentence-tiles.js",
  "/chinese/js/exercise-sessions.js?v=20261111-4",
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
  "/chinese/data/lesson11.json",
  "/chinese/data/lesson12.json",
  "/chinese/data/lesson13.json",
  "/chinese/data/lesson14.json",
  "/chinese/data/lesson15.json",
  "/chinese/data/lesson16.json",
  "/chinese/data/lesson17.json",
  "/chinese/data/lesson18.json",
  "/chinese/data/lesson19.json",
  "/chinese/data/lesson20.json",
  "/chinese/assets/sonya-lesson1-documents.svg",
  "/chinese/assets/sonya-lesson1-campus.svg",
  "/chinese/assets/sonya-lesson2-apartment.svg",
  "/chinese/assets/sonya-lesson2-details.svg",
  "/chinese/assets/lesson8-vocabulary.svg",
  "/chinese/assets/lesson11-vocabulary.svg",
  "/chinese/assets/gallery-studio.svg",
  "/chinese/assets/winter-plan.svg",
  "/chinese/assets/word-search-room.svg",
  "/chinese/assets/tech-bike.svg",
  "/chinese/assets/tech-video.svg",
  "/chinese/assets/arts-rehearsal.svg",
  "/chinese/assets/arts-opera.svg",
  "/chinese/assets/travel-train.svg",
  "/chinese/assets/travel-airport.svg",
  "/chinese/assets/fitness-gym.svg",
  "/chinese/assets/fitness-training.svg",
  "/chinese/assets/plans-desk.svg",
  "/chinese/assets/plans-office.svg",
  "/chinese/assets/internship-notice.svg",
  "/chinese/assets/internship-interview.svg",
  "/chinese/assets/lesson14-tea-shop.svg",
  "/chinese/assets/lesson14-shoes.svg",
  "/chinese/assets/festival-zoo.svg",
  "/chinese/assets/festival-home.svg",
  "/chinese/assets/family-shop.svg",
  "/chinese/assets/family-room.svg",
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
