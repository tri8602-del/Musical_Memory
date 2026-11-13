// Offline support for Maddy's Do-Re-Mi Trainer.
// Bump VERSION when shipping changes; old caches are deleted on activate.
const VERSION = "v2";
const CACHE = "maddy-musical-memory-" + VERSION;
const PIANO = ["Fs3","A3","C4","Ds4","Fs4","A4","C5","Ds5","Fs5","A5","C6","Ds6","Fs6","A6","C7"].map(n => "./piano/" + n + ".mp3");
const SHEET = [1,2,3,4,5,6,7,8].map(n => "./music/handel/line" + n + ".png");
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", ...SHEET, ...PIANO];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("maddy-musical-memory-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Pages: network first (so updates arrive), cached copy when offline.
// Everything else: cache first, filled from the network.
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put("./index.html", copy)); }
        return res;
      }).catch(() => caches.match("./index.html", {ignoreSearch: true}))
    );
    return;
  }
  e.respondWith(
    caches.match(req, {ignoreSearch: true}).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }))
  );
});
