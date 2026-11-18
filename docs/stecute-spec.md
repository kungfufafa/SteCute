# Stecute — Spesifikasi Tunggal

Dokumen: Spesifikasi produk + teknis (konsolidasi)
Versi: 2.0
Tanggal: 2026-11-18
Status: Mencerminkan perilaku kode yang terverifikasi per 2026-11-18
Pengganti: seluruh paket dokumen lama (PRD, user-flow, technical design, asset/production spec, release checklist, catatan QA & code review) — dihapus 2026-11-18

Dokumen ini adalah satu-satunya sumber kebenaran tertulis untuk produk dan arsitektur Stecute. Bagian 1–6 mendeskripsikan apa yang benar-benar diimplementasikan kode. Bagian 7 adalah roadmap yang belum dibangun. Jika kode dan dokumen ini berbeda, perbaiki dokumen ini lewat audit drift (lihat docs/README.md).

---

## 1. Ringkasan produk

Stecute adalah aplikasi web photo booth offline-first tanpa login. Pengguna membuka aplikasi, memberi izin kamera atau mengunggah foto lokal, mengambil beberapa foto berurutan dengan timer, melakukan review dan retake per pose, lalu menyimpan hasil sebagai photo strip — tanpa akun, tanpa upload foto ke server.

Prinsip utama:

- Tanpa login; semua proses inti berjalan lokal di device.
- Offline-first setelah app shell dan aset inti tercache (PWA).
- Foto dan hasil akhir disimpan lokal secara default; tidak ada analytics, tidak ada CDN eksternal.
- Font (Poppins) dan model MediaPipe di-self-host.
- Output berbasis capability: `share`, `save to device`, dan `print` tidak dijamin tersedia di semua browser; selalu ada fallback unduh.
- Pada browser yang mendukung, sesi kamera menghasilkan dua output lokal: photo strip statis (PNG/JPG) dan Live Cam strip bergerak (WebM tanpa audio).
- Duet: dua device bergabung dalam satu room lewat kode; sinkronisasi peer-to-peer dengan relay HTTP sebagai transport pembantu.

Scope v1 yang terkunci:

- Layout: 2, 3, 4, 6 pose.
- Template: Classic, Youth, Mono.
- Ekspor: PNG default, JPG opsional.
- Retensi galeri: 10 render final.
- Upload: JPG/PNG/WebP, maksimum 10 MB per file.
- Retake per pose: termasuk v1.
- Event preset dan auto-reset: tidak termasuk v1.

## 2. Alur inti

Landing (`/`) punya tiga entri: **Mulai Foto** (solo kamera), **Foto Duet** (booth bareng), **Upload Lokal**. Kosakata UI saat ini masih memakai istilah booth/host/guest, bukan Solo/Duet (lihat Roadmap).

Peta rute (`src/app/router/index.ts`):

| Rute | Fungsi |
|---|---|
| `/` | Landing, tiga entri utama |
| `/camera` | Preview + capture solo (pengaturan sesi inline) |
| `/upload` | Upload foto lokal |
| `/config` | Konfigurasi sesi lama (SessionConfigView) |
| `/capture` | Capture legacy |
| `/review` | Review + retake per pose + dekorasi |
| `/render` | Compositing strip |
| `/output` | Aksi output (unduh/share/save/print/Live Cam) |
| `/gallery` | Galeri lokal (retensi 10) |
| `/booth` | Hub Duet (buat/gabung room) |
| `/j/:code` | Join room Duet via kode |
| `/reset` | Reset sesi — yatim, tidak ada navigasi ke sini |
| `/privacyscreen` | Layar privasi |
| `/privacy`, `/terms`, `/faq`, `/about` | Halaman publik (SEO) |
| `*` | Not found |

### 2.1 Solo capture (kamera)

1. `/camera` — izin kamera, preview 4:3 (rasio hardcoded, tidak mengikuti layout), pilih kamera, filter, efek kamera, latar virtual.
2. Pengaturan sesi inline di halaman kamera (layout, template, timer, auto-capture) lewat panel `CaptureSessionSettings`.
3. Countdown per pose → still tertangkap → ulangi sampai semua slot terisi. Label progres memakai komponen `FlowProgress`.
4. `/review` — review semua pose, retake per pose, dekorasi (sticker, tanggal/waktu, logo text).
5. `/render` — compositing strip (worker, lihat §5.4).
6. `/output` — unduh ke perangkat, share/save bila didukung, print, unduh Live Cam.
7. Hasil masuk galeri; sesi selesai.

`/config` (SessionConfigView) dan `/capture` (capture-legacy) adalah rute konfigurasi/capture lama yang masih ada di router. Rute `/reset` terdaftar tetapi yatim — tidak ada navigasi ke sana.

### 2.2 Upload lokal

1. `/upload` — pilih file JPG/PNG/WebP, maksimum 10 MB per file, jumlah file divalidasi terhadap jumlah slot layout.
2. Adjust/crop per foto (hasil adjust di-encode JPEG).
3. Masuk review → render → output seperti alur kamera, tanpa Live Cam.

### 2.3 Duet booth

1. `/booth` (BoothHubView) — host membuat room dengan kode; guest membuka `/j/:code`.
2. Kode room dinormalisasi: trim, hapus spasi/tanda hubung, uppercase — join bersifat case-insensitive.
3. Room dibatasi **2 peserta**.
4. Kedua peserta mengambil foto sesuai layout yang sama; hasil capture dikirim antar peer (still PNG, status capture, konfigurasi, latar).
5. Latar virtual custom milik host disinkronkan ke guest (bukan local-only).
6. **Reset hanya bisa dipicu host** dan berlaku untuk kedua peserta.
7. Hasil akhir dirender dan tersedia di kedua device; Live Cam duet diproduksi tetapi belum ada tombol unduhnya (lihat Roadmap).

Kamera duet saat ini langsung menyala saat hub/room dibuka (izin tidak ditunda — lihat Roadmap).

### 2.4 Galeri

- `/gallery` menampilkan maksimal 10 render final terbaru.
- Hapus per item atau bersihkan semua ("Bersihkan Semua Data Lokal").
- Indikator penggunaan penyimpanan (estimasi `navigator.storage.estimate`), peringatan saat pemakaian melewati 70 MB atau 80% kuota.
- Render tidak menyimpan marker mode solo/duet (lihat Roadmap).

## 3. Aturan fungsional (perilaku kode terverifikasi)

### 3.1 Sesi kamera dan pengaturan

- Timer countdown: 3 / 5 / 10 detik, default **3**. Auto-capture bisa dinyalakan.
- Pengaturan sesi bisa diubah inline dari halaman kamera/room sebelum capture dimulai.
- Saat countdown berjalan, kontrol pengaturan **disabled** (tombol tetap tampil); setelah foto pertama tersimpan (`capturedCount > 0`), tombol "Ubah pengaturan sesi" dihapus dari DOM. Guard `openEditor` menolak pembukaan editor saat locked.
- Di Duet, hanya host yang bisa mengubah konfigurasi sesi (`canManageSessionConfig`).
- Mengubah konfigurasi sesi di path kamera me-restart sesi (pose yang sudah diambil dibuang).
- Reset sesi di path kamera **mempertahankan** konfigurasi, latar virtual, pilihan kamera, dan setting audio.
- Pengecualian (realitas kode): tombol "Ulang Semua" di Review menghapus sesi **beserta konfigurasi** — berbeda dari aturan reset path kamera.
- Urutan pose (`shots.order`) **0-based**.

### 3.2 Kamera dan mirror

- Preview dan capture memakai rasio **4:3** hardcoded, terlepas dari layout.
- Aturan mirror (`shouldMirrorCamera`): kamera belakang (`environment`) **tidak pernah** di-mirror; kamera depan (`user`/selfie) di-mirror di preview, dan still ditangkap ter-flip agar konsisten dengan preview.
- Tile remote Duet di-mirror mengikuti **facing mode peer remote** (kamera depan teman → mirror; kamera belakang teman → jangan mirror), bukan facing mode viewer lokal. Aturan yang sama berlaku untuk Live Cam pasangan.

### 3.3 Layout, template, kanvas

Layout bawaan (konfigurasi TS statis di `src/layouts/`, tidak di-seed ke database):

| ID | Slot | Kanvas (px) | Slug nama file |
|---|---|---|---|
| `strip-2-vertical` | 2 | 1200 × 1910 | `2x6-mini-strip` |
| `strip-3-vertical` | 3 | 1200 × 2740 | `2x6-tall-strip` |
| `strip-4-vertical` | 4 | 1200 × 3570 | `2x6-classic-strip` |
| `strip-6-vertical` | 6 | 1200 × 5230 | `2x6-6photo-strip` |

Template bawaan (`src/templates/`): `classic` (clean), `youth` (pastel pink, #fce4ec/#fff7fb), `mono` (monokrom). Warna template masih hardcoded dengan special-case per id di renderer — bukan mesin data-driven penuh. Latar gingham hardcoded `#fff7ed`.

### 3.4 Upload

- Format: JPG/JPEG, PNG, WebP (validasi MIME + ekstensi, termasuk alias `image/jpg`/`image/pjpeg`).
- Batas ukuran: **10 MB per file**; jumlah file harus sesuai jumlah slot.
- Gambar yang di-adjust di-encode ulang sebagai JPEG (quality 0.92).

### 3.5 Render dan output

- Render berjalan di **Web Worker + OffscreenCanvas** bila didukung; fallback otomatis ke main thread.
- Dekorasi sticker, tanggal/waktu, dan logo text sudah diimplementasikan di kedua path render (worker dan main thread).
- Overlay face-tracking tetap digambar dengan perkiraan bounds saat `faceBounds` kosong (realitas kode).
- Live Cam: strip bergerak **WebM** (codec VP9 → VP8 fallback), **tanpa audio**. Kegagalan render Live Cam tidak membatalkan output foto.
- Nama file: `stecute-YYYYMMDD-HHMMSS-{slugLayout}-{templateId}.{ext}` (contoh: `stecute-20261118-143005-2x6-classic-strip-classic.png`).
- Ekspor PNG default, JPG opsional.
- Output berbasis capability: unduh selalu ada; save (`showSaveFilePicker`), share (`navigator.share` dengan file test), dan print (iframe dengan stylesheet inline) hanya bila didukung.

### 3.6 Galeri dan penyimpanan

- Retensi hardcoded **10 render** (`GALLERY_RETENTION_LIMIT`); render terlama dihapus beserta sesi, shot, dan asset terkait.
- Sesi basi dibersihkan otomatis setelah **24 jam** (`cleanupStaleSessions`).
- Penyimpanan IndexedDB memakai Blob; bila cloning Blob gagal (mis. Safari lama), fallback otomatis ke ArrayBuffer (`writeBlobWithFallback`).
- **Fallback kuota** saat menyimpan render:
  1. Bila penyimpanan dengan Live Cam gagal, coba lagi tanpa Live Cam — "Live Cam belum dapat disimpan. Foto PNG tetap tersedia."
  2. Bila tetap gagal, render hidup di memori (`id: memory-…`) dan pengguna diperingatkan untuk mengunduh hasil sebelum menutup halaman.
- Error kuota di semua layar (kamera, upload, review, render) memakai pesan terpadu: minta hapus hasil lama di galeri.

### 3.7 Latar virtual

- Katalog latar bawaan + upload gambar custom.
- Normalisasi gambar custom: sisi terpanjang maksimum **1600 px**, di-encode JPEG ≤ **512 KiB** (scale-down bertahap bila masih besar), hash **SHA-256** sebagai identitas aset.
- Segmentasi memakai MediaPipe Selfie Segmenter yang di-host lokal (`public/vendor/mediapipe/`), diproses di worker (`segment.worker.ts`).
- Di Duet, gambar latar host disinkronkan ke guest. Protokol: request aset → retry pada 2 detik dan 5 detik → **timeout 10 detik** memunculkan modal recovery dengan opsi "Pakai latar asli untuk semua".

### 3.8 Efek kamera dan filter

- Pack efek frame animasi: `kicau-mania` (53 frame), `windut` (45 frame), `bluebirds` (12 frame), `hearts` (3 frame) — lihat inventaris §6.
- Overlay face-tracking: `ft-crown`, `ft-cat`, `ft-devil`, `ft-halo`, `ft-flower`, `sparkles`.
- Saat sprite bundel gagal dimuat, renderer efek memakai fallback vektor prosedural (bukan bitmap bundel).

### 3.9 Transport Duet

- Transport gabungan: **HTTP relay + BroadcastChannel + WebRTC (PeerJS)**. Pesan diduplikasi lintas transport dengan dedupe berbasis nonce.
- Payload disegel **AES-GCM** (`seal.ts`).
- Relay: Netlify Function `booth-relay`, endpoint `/api/booth-relay/:code`. Buffer **80 pesan per room**, TTL room **30 menit**, body maksimum 6 MiB.
- Realitas kode: still dan background **tetap dipost ke relay HTTP** setelah WebRTC tersambung — relay bukan sekadar fallback signaling. Foto tidak disimpan permanen di server (buffer sementara, TTL).
- STUN/TURN via PeerJS dan metered.live/metered.ca (diizinkan CSP `connect-src`).

### 3.10 PWA dan offline

- `vite-plugin-pwa`; app shell dan aset inti precache; aplikasi tetap berfungsi offline setelah kunjungan pertama.
- **Update hold**: service worker baru tidak langsung aktif. `onNeedRefresh` menyimpan aksi update tertunda dan prompt hanya muncul pada route/status sesi yang aman (tidak di tengah capture).
- Indikator offline-ready di shell.
- Catatan realitas kode: frame animasi overlay efek kamera **dikecualikan dari precache** dan hanya memakai CacheFirst runtime — pada pemakaian offline pertama yang belum pernah memuat efek, overlay bisa kosong.
- Stylesheet print dibuat inline di iframe, bukan aset precache terpisah.

### 3.11 Keamanan dan privasi

- Header CSP ketat (`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `script-src 'self' 'wasm-unsafe-eval'`; `connect-src` hanya self + PeerJS + metered TURN) dan `Permissions-Policy: camera=(self), microphone=(self)` — didefinisikan ganda di `public/_headers` dan `public/netlify.toml`.
- `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, COOP `same-origin`.
- Halaman aplikasi (camera/upload/review/gallery/booth/dll.) di-`noindex`; halaman publik (privacy/terms/faq/about) boleh diindex.
- Tanpa analytics, tanpa font/asset remote, tanpa login.
- Audio duet (mic) opsional dan dikontrol per peserta (`BoothAudioControls`); Live Cam tetap tanpa audio.

## 4. Keputusan desain yang menyimpang dari rancangan lama

Penyimpangan berikut adalah realitas kode yang diterima; dokumen lama sudah dihapus:

- **Tidak ada tabel `app_settings`.** Konfigurasi sesi persist ke `sessionStorage`, bukan IndexedDB (lihat §5.3). Retensi galeri hardcoded, bukan setting.
- **Tidak ada field `assets.sessionId`.** `packId` dipakai ganda sebagai kunci sesi untuk asset.
- **Layout/template tidak di-seed ke DB.** Hanya konfigurasi TS statis; `LayoutRepository` tidak dipakai jalur utama.
- **Deployment Netlify**, bukan Cloudflare Pages.
- Tidak ada sistem kode error-group; error memakai pesan bahasa manusia per layar.
- `shots.order` 0-based (bukan 1..N).
- Tombol unduh solo berlabel "Unduh ke Perangkat"/"Unduh Foto", bukan "Unduh PNG".

## 5. Arsitektur teknis

### 5.1 Stack

Vue 3 + Vite + TypeScript, Vue Router, Pinia, Dexie (IndexedDB), Tailwind CSS 4, Vitest (unit), Playwright (e2e). Dependency runtime lain: `@mediapipe/tasks-vision`, `peerjs`, `vite-plugin-pwa`.

### 5.2 Peta direktori src/

```
src/
├── app/            # bootstrap: providers, router, seo, store (Pinia)
│   └── store/      # useAppStore, useCameraStore, useCapabilityStore,
│                   # useCustomTemplateStore, useGalleryStore, useSessionStore
├── assets/         # camera-effects (sprite pack + thumbnails), fonts (Poppins)
├── components/     # common (CaptureSessionSettings, FlowProgress, dll.), layout (MainShell)
├── db/             # schema.ts (Dexie), blob.ts (fallback ArrayBuffer), repositories/
├── features/       # layar per fitur: landing, camera, upload, session-config,
│                   # review, renderer, output, gallery, booth (hub+room),
│                   # reset-session, public-info
├── layouts/        # strip-2 / strip-3 / strip-4 / strip-6 (config statis)
├── services/       # logika non-UI: booth, camera, camera-effects, face-tracking,
│                   # filter, live-cam, output, pwa, render, session, storage,
│                   # template-upload, upload, virtual-background
├── styles/         # Tailwind + token desain
├── templates/      # classic / youth / monochrome (config statis)
├── ui/             # primitif UI bersama
├── utils/          # util umum
├── vite/           # util build
└── workers/        # render.worker.ts, segment.worker.ts
```

Tidak ada folder `services/cache`, `services/capability`, atau `features/countdown|capture|event-mode` — capability ada di `useCapabilityStore`, countdown/capture hidup di `CameraView`/`BoothRoomView`.

### 5.3 Data dan persistensi

- **Dexie/IndexedDB** (`src/db/schema.ts`): tabel `sessions`, `shots`, `renders` (termasuk kolom `layoutId`/`templateId` dan `live*` untuk Live Cam), `assets` (type: `frame`-set pack, `sticker`, `template-preview`, dll.; kunci sesi via `packId`).
- **sessionStorage** (`src/services/session/persist.ts`) untuk kontinuitas alur: `stecute.activeSessionId`, `stecute.pendingCameraConfig`, `stecute.pendingBoothSetup`, `stecute.retakeIndex`, `stecute.cameraFlow`. Ini menjaga konfigurasi tetap hidup antar navigasi/refresh dalam satu tab; bukan penyimpanan jangka panjang.
- Blob gambar disimpan sebagai Blob dengan fallback ArrayBuffer untuk browser yang gagal meng-clone Blob ke IndexedDB.
- Migrasi DB dijalankan fire-and-forget saat boot (`AppProvider.vue`) — belum ada layar consent kegagalan migrasi (Roadmap).

### 5.4 Pipeline render

1. `services/render` mengumpulkan shot + konfigurasi layout/template/dekorasi.
2. Bila `Worker` + `OffscreenCanvas` tersedia → `workers/render.worker.ts`; jika tidak → path main thread dengan hasil setara.
3. Hasil: Blob PNG/JPG + metadata ukuran; Live Cam dirender terpisah oleh `services/live-cam` (WebM).
4. `services/session` menyimpan render, menandai sesi completed, menghapus shot/asset sesi, lalu menegakkan retensi 10 render (§3.6).

### 5.5 Deployment

- **Netlify** saja: build `npm run build` (generate SEO assets → typecheck → vite build → tulis halaman SEO), publish `dist/`.
- `netlify/functions/booth-relay.mjs` (sumber bersama: `server/booth-relay.mjs`) untuk relay Duet; redirect `/api/booth-relay/:code` → function.
- Header keamanan dan cache didefinisikan di `public/_headers` dan `public/netlify.toml` (harus dijaga konsisten keduanya).
- SPA fallback `/*` → index; aset statis immutable 1 tahun; `sw.js`/manifest no-cache.

### 5.6 Testing

- Unit: Vitest, co-located di `__tests__/` per service/feature.
- E2E: Playwright (`e2e/`). Catatan: kegagalan tes settings-lock adalah bug tes (assertion `toHaveCount(0)` sebelum foto pertama, padahal komponen memakai `disabled` saat countdown) — komponen sudah memenuhi aturan §3.1.
- Perintah: `npm run dev`, `dev:https` (LAN + sertifikat lokal, lihat README root), `build`, `typecheck`, `lint`, `test`, `test:e2e`, `pwa:audit`.

## 6. Inventaris aset (kondisi disk sebenarnya)

### 6.1 Ada di repo

`public/`:

- `icons/` — ikon PWA: `icon-192x192.png/.svg`, `icon-512x512.png/.svg`, `icon-512x512-maskable.png`, `apple-touch-icon.png`.
- `images/` — preview strip template: `classic-strip-preview.webp`, `mono-strip-preview.webp`, `youth-strip-preview.webp`.
- `vendor/mediapipe/` — WASM tasks-vision + model `blaze_face_short_range` (face detector) dan `selfie_segmenter` (float16, `.tflite`), semuanya lokal.
- `favicon.svg`, `icons.svg`, `_headers`, `_redirects`, `netlify.toml`, `robots.txt`, `sitemap.xml`.

`src/assets/`:

- `fonts/` — Poppins self-hosted: Regular, Medium, SemiBold, Bold (`.woff2`).
- `camera-effects/kicau-mania/` — **53 frame PNG**.
- `camera-effects/windut/` — **45 frame PNG**.
- `camera-effects/bluebirds/` — 12 frame PNG (bird small/medium/large × 4).
- `camera-effects/hearts/` — 3 PNG (small/medium/large).
- `camera-effects/thumbnails/` — 4 PNG (satu per pack).

### 6.2 Gap yang diketahui (jangan didokumentasikan sebagai tersedia)

- **6 PNG frame template `/assets/frames/*.png` tidak ada di disk.** Manifest mendaftarkannya dan konfigurasi template mereferensikannya, tetapi `frameAsset` tidak pernah dimuat renderer — strip dirender prosedural. Jangan menganggap frame bitmap tersedia.
- `og:image` menunjuk `/images/1770039834020.png` yang tidak ada di `public/images/`.
- Manifest aset tidak mencakup pack kicau-mania/windut, thumbnail, font, dan ikon; checksum frame kosong.
- Direktori `public/templates/` (sampel blanko upload) tidak ada.
- Metadata pack belum punya source/author/dateAdded/approver.

Aturan aset yang tetap berlaku: semua aset produksi self-hosted, tidak ada dependensi remote untuk alur inti, pack baru harus masuk manifest dengan checksum terisi.

## 7. Roadmap / belum diimplementasikan

Item berikut adalah rancangan yang **belum dibangun** — jangan dianggap perilaku saat ini:

- Beranda dua-entri Solo/Duet dengan kosakata Solo/Duet (kode masih booth/host/guest).
- Label progres 4 langkah terpadu dan label "Pose X dari Y" di solo.
- Izin kamera ditunda di hub/room Duet (saat ini keduanya start kamera on mount).
- Protokol koordinasi guest: Siap/"Sudah cocok", retake-request, guest-cancel.
- Ringkasan + consent pra-join untuk invitee.
- Alur upload lokal di Duet; sinkronisasi custom-frame Duet; camera picker Duet.
- Paritas unduh Live Cam di Duet (output video sudah ada, tombol unduh belum).
- Marker mode (solo/duet) di galeri.
- Notifikasi peer-left, konfirmasi keluar room, copy khusus offline Duet.
- Layar browser-tidak-didukung (saat ini hanya panel error kamera generik).
- Fallback kegagalan migrasi DB dengan consent pengguna.
- Mesin layout/template data-driven penuh + seeding DB (warna masih hardcoded).
- Event preset dan auto-reset (di luar v1).
- Perbaikan gap aset §6.2 (frame PNG, og:image, manifest/checksum).

---

Riwayat: dokumen ini menggantikan 8 dokumen lama (~3800 baris) yang sebagian besar berisi rancangan aspirasional dan catatan QA historis. Temuan audit terakhir yang menjadi dasar konsolidasi: `2026-11-18_DRIFT_REPORT.md` di root repo.