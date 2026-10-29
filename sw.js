/* Offline support: always try the network first, so new material appears as soon as
   a student is online; fall back to the saved copy when offline. */
var CACHE = 'tang-study-v2';
var SHELL = ['./', 'index.html', 'style.css', 'app.js', 'lib/hanzi-writer.min.js', 'data/content.json', 'fonts/kai.css'];

function cjk(s) { return Array.from(s).filter(function (c) { return /[㐀-鿿豈-﫿]/.test(c); }); }

async function everything() {
  var files = SHELL.slice();
  try {
    var data = await (await fetch('data/content.json', { cache: 'no-cache' })).json();
    var chars = new Set();
    Object.keys(data.lexicon).forEach(function (k) {
      cjk(k).forEach(function (c) { chars.add(c); });
      if (data.lexicon[k].simp) cjk(data.lexicon[k].simp).forEach(function (c) { chars.add(c); });
    });
    chars.forEach(function (c) { files.push('strokes/' + encodeURIComponent(c) + '.json'); });
    var css = await (await fetch('fonts/kai.css', { cache: 'no-cache' })).text();
    (css.match(/kai-[0-9a-f]+\.woff2/g) || []).forEach(function (f) { files.push('fonts/' + f); });
  } catch (e) {}
  return files;
}

async function refresh() {
  var cache = await caches.open(CACHE);
  var files = await everything();
  await Promise.all(files.map(function (f) {
    return fetch(f, { cache: 'no-cache' }).then(function (r) { if (r.ok) return cache.put(f, r); }).catch(function () {});
  }));
}

self.addEventListener('install', function (e) { e.waitUntil(refresh().then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  var isContent = url.pathname.endsWith('/data/content.json');
  // Ask the server whether each file has changed, rather than trusting the browser's ten-minute copy.
  var req = url.origin === self.location.origin ? new Request(e.request, { cache: 'no-cache' }) : e.request;
  e.respondWith(
    fetch(req).then(function (r) {
      if (r && (r.ok || r.type === 'opaque')) {
        if (isContent) {
          // New material: save its stroke files and glyphs for offline use as well.
          var probe = r.clone();
          e.waitUntil(Promise.all([probe.json(), caches.match('data/content.json')]).then(async function (v) {
            var old = v[1] ? (await v[1].json()).version : null;
            if (old !== v[0].version) return refresh();
          }).catch(function () {}));
        } else {
          var copy = r.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
      }
      return r;
    }).catch(function () {
      return caches.match(e.request, { ignoreSearch: true }).then(function (m) { return m || caches.match('index.html'); });
    })
  );
});
