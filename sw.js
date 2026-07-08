const CACHE_NAME = 'narcotic-ward-v1';
const ASSETS = [
  './',
  'index.html',
  'dashboard.html',
  'stock.html',
  'disbursement.html',
  'shiftcount.html',
  'report.html',
  'settings.html',
  'style.css',
  'api.js',
  'app.js',
  'fixes.js',
  'navbar.html',
  'manifest.json',
  'icon-app.png'
];

// ติดตั้ง Service Worker และทำการเก็บ Cache ไฟล์พื้นฐาน
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// เปิดการใช้งานและล้าง Cache เก่า
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// จัดการ Fetch Request แบบ Network First (เพื่ออัปเดตข้อมูลจริงก่อน ถ้าออฟไลน์ค่อยดึง Cache)
self.addEventListener('fetch', event => {
  // ข้ามการยิงดึงข้อมูล API จาก Google
  if (event.request.url.includes('google.com') || event.request.url.includes('script.google')) {
    return;
  }
  
  event.respondWith(
    fetch(event.request).then(response => {
      // เซฟข้อมูลเข้า cache เพื่อใช้งานต่อ
      if (response && response.status === 200) {
        const responseCopy = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseCopy);
        });
      }
      return response;
    }).catch(() => {
      return caches.match(event.request);
    })
  );
});
