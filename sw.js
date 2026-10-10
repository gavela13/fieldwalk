// Field kit — offline shell cache.
// Cache-first for the app shell so a cold launch works with no signal.
// Bump CACHE on every deploy; the old cache is dropped on activate.
var CACHE = 'fieldwalk-v2';
var SHELL = ['./', './index.html', './smoketest.html', './manifest.webmanifest'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // addAll fails the whole install if any one URL 404s, so add
      // individually and tolerate misses.
      return Promise.all(SHELL.map(function (u) {
        return c.add(u).catch(function () { return null; });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET') return;
  if (new URL(r.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(r, { ignoreSearch: true }).then(function (hit) {
      if (hit) {
        // Serve cache immediately, refresh in the background when online.
        fetch(r).then(function (res) {
          if (res && res.ok) caches.open(CACHE).then(function (c) { c.put(r, res); });
        }).catch(function () {});
        return hit;
      }
      return fetch(r).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(r, copy); });
        }
        return res;
      }).catch(function () {
        // Navigation with no cache and no network: fall back to the app shell.
        if (r.mode === 'navigate') return caches.match('./index.html');
        throw new Error('offline and uncached');
      });
    })
  );
});
