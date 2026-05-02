# Stecute QA Findings

Tanggal: 2026-05-02

## Cakupan real browser

- Chromium desktop
- Mobile Chrome emulation
- Mobile Safari emulation
- Alur: landing, konfigurasi sesi, upload invalid, upload valid 4 foto, review, render output, galeri lokal, dan fallback route

## Temuan dan status

| Severity | Temuan | Perbaikan | Status |
|---|---|---|---|
| P1 | Mobile Safari gagal lanjut dari upload ke review setelah memilih 4 file valid. Error browser: `UnknownError: Error preparing Blob/File data to be stored in object store`. | Persistence layer tetap menulis Blob lebih dulu, lalu retry sebagai ArrayBuffer binary jika IndexedDB browser menolak Blob/File. Data dibaca kembali sebagai Blob oleh API aplikasi. | Fixed |
| P2 | Pesan validasi upload masih campuran bahasa Inggris. | Pesan validasi file kosong, format tidak didukung, dan batas 10 MB dilokalkan ke Bahasa Indonesia. | Fixed |
| P2 | Tab kustomisasi berbasis ikon tidak punya accessible name yang stabil untuk browser automation dan pembaca layar. | Fitur kustomisasi manual dihapus dari scope v1 process-first, sehingga tab tidak lagi tersedia di flow aktif. | Superseded |

## Verifikasi

- `npm run typecheck` passed
- `npm run lint` passed
- `npm run test` passed: 4 tests
- `npm run test:e2e` passed: 21 tests di Chromium, Mobile Chrome, dan Mobile Safari
- `npm run build` passed

---

## QA pass 2026-05-02 malam

### Cakupan

- Chromium desktop real browser via in-app browser
- Chromium desktop Playwright production preview
- Mobile Chrome emulation Playwright
- Mobile Safari emulation Playwright/WebKit
- Camera flow memakai fake media stream browser sampai review
- Upload lokal valid 4 foto sampai output dan gallery
- Upload invalid
- Offline reload route gallery setelah service worker ready

### Batasan

- Real device fisik belum bisa dieksekusi dari environment ini. Android tidak terdeteksi via `adb`; iPhone terdeteksi tetapi statusnya offline, sehingga belum bisa dipakai untuk QA browser fisik.

### Hasil verifikasi

- `npm run typecheck` passed
- `npm run lint` passed
- `npm run test` passed: 4 tests
- `npm run build` passed
- `npm run test:e2e` passed: 21 tests
- Production offline probe passed: service worker ready, `/gallery` tetap terbuka saat browser context offline
- Camera fake-media flow passed sampai `/review`

### Temuan baru

| Severity | Temuan | Bukti | Rekomendasi | Status |
|---|---|---|---|---|
| P1 | Render final masih berjalan di main thread, belum memakai render worker seperti target teknis. Pada device mobile dengan 6 foto besar, decode, compositing, dan export canvas berisiko membuat UI freeze. | `src/services/render/index.ts` membuat `document.createElement('canvas')` dan decode/render langsung di main thread; `src/workers/render.worker.ts` ada tetapi tidak dipakai. | Wire render pipeline ke worker untuk browser yang mendukung, dengan fallback main thread. Pastikan worker parity untuk layout dan template default. | Open |
| P2 | Retake seluruh sesi dari upload flow mengembalikan user ke `/config` tanpa `source=upload`, sehingga konfigurasi berikutnya default ke kamera. | Setelah upload valid masuk review lalu klik `Ulang Semua`, URL menjadi `/config`. | Simpan source sebelum reset atau route ke `/config?source=upload` saat session sebelumnya berasal dari upload. | Open |
| P2 | Camera capture memunculkan warning Dexie karena query `sessionId + order` tidak punya compound index. | Fake-media camera flow menghasilkan warning: query `{sessionId, order}` would benefit from compound index. Schema saat ini `shots: 'id, sessionId, order'`. | Tambah migration Dexie dengan index `[sessionId+order]`, lalu update repository query. | Open |
| P2 | Beberapa tombol ikon utama belum punya accessible name eksplisit. | Tombol back/settings/shutter/switch camera di `CameraView`, back button di config/upload/gallery hanya mengandalkan SVG atau simbol. | Tambahkan `aria-label` pada semua icon-only buttons dan test role/name untuk flow kamera. | Open |
| P2 | Direct access atau reload ke `/output` tanpa `renderId` tetap menampilkan state sukses dan placeholder strip. | Buka `/output` langsung menampilkan `Hasil Siap!` walau tidak ada render aktual di state. | Jika tidak ada `renderId`, redirect ke gallery/review atau tampilkan empty/error state dengan CTA yang benar. | Open |
| P3 | Copy konfirmasi gallery dan update prompt masih berbahasa Inggris. | `Delete this photo strip?`, `Delete all saved photo strips?`, `Update Available`, `Update Now`, `Later`. | Lokalkan ke Bahasa Indonesia dan gunakan copy yang konsisten dengan flow lain. | Open |
| P3 | Landing masih memakai gradient text dan ambient glow dekoratif yang bertentangan dengan design anti-pattern rules. | `bg-clip-text bg-linear-to-r` di headline dan dua background glow absolut. | Ganti ke solid accent text dan dekorasi yang lebih spesifik ke photo booth/strip. | Open |
