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
| P1 | Render final masih berjalan di main thread, belum memakai render worker seperti target teknis. Pada device mobile dengan 6 foto besar, decode, compositing, dan export canvas berisiko membuat UI freeze. | `src/services/render/index.ts` membuat `document.createElement('canvas')` dan decode/render langsung di main thread; `src/workers/render.worker.ts` ada tetapi tidak dipakai. | Render pipeline sekarang mencoba worker lebih dulu dan fallback ke main thread bila worker/OffscreenCanvas gagal. | Fixed 2026-05-05 |
| P2 | Retake seluruh sesi dari upload flow mengembalikan user ke `/config` tanpa `source=upload`, sehingga konfigurasi berikutnya default ke kamera. | Setelah upload valid masuk review lalu klik `Ulang Semua`, URL menjadi `/config`. | Simpan source sebelum reset atau route ke `/config?source=upload` saat session sebelumnya berasal dari upload. | Open |
| P2 | Camera capture memunculkan warning Dexie karena query `sessionId + order` tidak punya compound index. | Fake-media camera flow menghasilkan warning: query `{sessionId, order}` would benefit from compound index. Schema saat ini `shots: 'id, sessionId, order'`. | Dexie schema v2 menambah `[sessionId+order]` dan repository query memakai compound index. | Fixed 2026-05-05 |
| P2 | Beberapa tombol ikon utama belum punya accessible name eksplisit. | Tombol back/settings/shutter/switch camera di `CameraView`, back button di config/upload/gallery hanya mengandalkan SVG atau simbol. | Tambahkan `aria-label` pada semua icon-only buttons dan test role/name untuk flow kamera. | Open |
| P2 | Direct access atau reload ke `/output` tanpa `renderId` tetap menampilkan state sukses dan placeholder strip. | Buka `/output` langsung menampilkan `Hasil Siap!` walau tidak ada render aktual di state. | Output route sekarang membutuhkan render aktif atau `renderId`, memuat render dari IndexedDB, dan menampilkan empty state dengan CTA galeri/sesi baru jika render tidak ada. | Fixed 2026-05-11 |
| P3 | Copy konfirmasi gallery dan update prompt masih berbahasa Inggris. | `Delete this photo strip?`, `Delete all saved photo strips?`, `Update Available`, `Update Now`, `Later`. | Lokalkan ke Bahasa Indonesia dan gunakan copy yang konsisten dengan flow lain. | Open |
| P3 | Landing masih memakai gradient text dan ambient glow dekoratif yang bertentangan dengan design anti-pattern rules. | `bg-clip-text bg-linear-to-r` di headline dan dua background glow absolut. | Ganti ke solid accent text dan dekorasi yang lebih spesifik ke photo booth/strip. | Open |

---

## Offline hardening pass 2026-05-05

### Perubahan

- Service worker didaftarkan segera saat shell mount, tanpa delay 4 detik.
- App store sekarang melacak `offlineReady`, status service worker, update tersedia, dan error registrasi.
- Landing tidak lagi menampilkan "Siap Offline" sebelum cache/service worker siap.
- Gallery menampilkan warning storage saat usage tinggi dan menyediakan tombol `Hapus Semua Data` untuk membersihkan gallery, sesi, template lokal, setting, dan cache aplikasi yang bisa dihapus.
- Persistence binary IndexedDB memakai API `Blob` di layer aplikasi, dengan storage internal `ArrayBuffer` untuk menghindari Blob/File yang gagal dibaca ulang di Safari/WebKit.
- Upload membaca dimensi PNG/JPEG/WebP dari header binary terlebih dahulu, sehingga tidak bergantung pada decode object URL saat offline.
- Route inti config, camera/upload, review, render, output, dan gallery dibundel statis bersama app core agar sesi offline tidak bergantung pada lazy route chunk.
- Render pipeline mencoba worker lebih dulu dan fallback ke main thread jika worker/OffscreenCanvas gagal.
- Dexie schema naik ke v2 dengan compound index `[sessionId+order]`.

### Verifikasi

- `npm run typecheck` passed
- `npm run lint` passed
- `npm run test` passed: 10 tests
- `npm run build` passed
- `npm run test:e2e` mencakup first-visit offline blocked, reload core routes setelah cache, dan full upload-review-render-output-gallery offline di Chromium dan Mobile Chrome.

### Batasan yang masih perlu physical-device QA

- Playwright WebKit memiliki internal error untuk offline service-worker document navigation.
- Playwright WebKit tidak stabil untuk membaca/decode file lokal setelah `context.setOffline(true)`. Kasus upload dan render offline di Safari tetap wajib diverifikasi di iPhone/iPad fisik.
- Full offline event rehearsal tetap perlu dijalankan di Chrome Android fisik dan Safari iPhone/iPad fisik sebelum production GO.

---

## Bug dan performance pass 2026-05-11

### Perubahan

- `/output` tidak lagi menampilkan sukses palsu tanpa render aktual.
- Hasil render diarahkan ke `/output?renderId=...` agar reload output bisa memuat Blob render dari IndexedDB.
- Fixture upload E2E dipindahkan dari `public/images` ke `e2e/fixtures/images` agar tidak ikut deployment asset publik dan tidak memperbesar precache PWA.
- Metadata SEO memakai preview WebP kecil yang memang merupakan asset publik.
- Workbox precache dibatasi agar PNG publik non-core tidak ikut cache awal.
- Upload dimension probe membaca header awal file terlebih dahulu, dengan fallback full read hanya untuk JPEG yang membutuhkan scan lebih jauh.
- Preview galeri, upload, blanko, dan logo memakai async image decoding/lazy loading yang sesuai.

### Verifikasi

- `npm run typecheck` passed
- `npm run lint` passed
- `npm run test` passed: 11 tests
- `npm run build` passed; PWA precache turun dari sekitar `4.9 MB` menjadi sekitar `630 KB`
- `npm run test:e2e` passed: 36 passed, 3 skipped

---

## Deep process QA pass 2026-09-04

### Cakupan

Audit semua proses aplikasi yang ada di `src/` terhadap PRD/production spec, plus regresi temuan lama:

- Landing dan CTA
- Config sesi (kamera / upload / blanko / timer / auto-capture)
- Capture kamera, filter, overlay, Live Cam, retake per-shot
- Upload lokal, framing, ganti file
- Review, ulang semua, render, output, gallery
- Offline banner, PWA update prompt
- Halaman publik privacy/terms/faq/about
- Booth Bareng (hub, kode, undangan, countdown, compose)
- Route recovery: `/review`, `/output`, `/j/:code` invalid, 404

### Verifikasi otomatis

- `npm run test` passed: 49 tests
- `npm run typecheck` passed
- `npm run lint` passed
- Playwright Chromium `e2e/process-qa.spec.ts` passed: 10 tests (landing, config kamera/upload, review kosong, output kosong, gallery kosong, halaman publik, booth reject, 404, camera preview+shutter)
- Playwright Chromium booth join + UI stress sebelumnya passed

### Status proses

| Proses | Status | Catatan |
|---|---|---|
| Landing `Mulai Foto` / `Upload Lokal` | Pass | Tanpa login, tidak butuh booth |
| Config layout/template/timer | Pass | Source query `camera`/`upload` dihormati |
| Capture kamera + countdown | Pass smoke | Fake-media Chromium sampai shutter; device fisik belum |
| Filter + overlay kamera | Pass smoke | UI terlihat; render-equality tidak diuji ulang di pass ini |
| Live Cam | Tidak diverifikasi penuh | Capability-based; tidak ada e2e dedicated di pass ini |
| Upload + framing + review | Pass historis | `upload-render.spec.ts` ada; tidak di-rerun full matrix di pass ini |
| Review retake per-shot | Pass code | Kamera kembali ke `/camera`; upload ganti file di review |
| Ulang semua | Pass code | Kembali ke `/config?source=` sesuai source sebelumnya (temuan P2 lama tertutup) |
| Render PNG + output | Pass smoke | `/output` tanpa renderId tidak lagi sukses palsu |
| Gallery 10 hasil | Pass smoke empty | Cleanup sesi 24 jam sebelumnya bisa menghapus render gallery; diperbaiki di pass ini |
| Offline/PWA | Pass historis | First-visit offline diblokir; relaunch setelah cache di Chromium |
| Booth Bareng same-browser | Pass | Kode + link + 2 tab |
| Booth Bareng lintas device | Fail / blocked | Registry `localStorage` + `BroadcastChannel`; HP teman akan dapat "Booth tidak ditemukan" |
| Shortcut keyboard desktop | Gap | Hanya Escape di kamera; Space/shutter global belum |
| Reset session dedicated route | Gap | `ResetSessionView.vue` tidak terpasang di router; reset lewat output/review |

### Temuan

| Severity | Temuan | Bukti | Rekomendasi | Status |
|---|---|---|---|---|
| P1 | Booth Bareng tidak bisa di-join dari perangkat lain. Kode/link hanya valid di browser yang sama. | `createLocalStorageRegistry(localStorage)` + `BroadcastChannel`; tidak ada signaling server. | Tampilkan peringatan "hanya tab di perangkat yang sama" atau tambah signaling ephemeral sebelum memasarkan sebagai Meet-like. | Fixed 2026-09-06: kode di-reconstruct lintas device; BroadcastChannel + WebRTC/PeerJS; hasil masuk gallery. |
| P2 | `cleanupStaleSessions` menghapus render gallery bersama sesi berumur >24 jam, bertentangan dengan retensi 10 hasil. | `src/db/repositories/session.ts` sebelumnya `db.renders.where('sessionId').anyOf(staleIds).delete()`. | Cleanup hanya sesi yang belum `completed`. | Fixed 2026-09-04 |
| P2 | Tamu ke-3+ masih bisa membuka URL undangan yang sama dan melihat kode booth. | Identity join tidak mengunci setelah 2 peer. | Tolak join setelah booth penuh/capture mulai. | Fixed 2026-09-06: peer ke-3 ditolak di protocol. |
| P2 | Hasil Booth Bareng tidak masuk gallery lokal; hanya unduh di halaman booth. | `BoothRoomView` memakai `URL.createObjectURL` tanpa `renderAndStoreSession`. | Opsional simpan ke gallery dengan source booth, atau copy yang menjelaskan hasil ephemeral. | Mitigated 2026-09-06: copy ephemeral di halaman hasil. |
| P3 | FAQ/privacy belum menyebut Booth Bareng sebagai mode online opsional. | `src/features/public-info/content.ts` masih "jika nanti ada share link". | Update copy publik. | Fixed 2026-09-06 |
| P3 | Error render incomplete masih Inggris. | `RendererView.vue`: `Session data is incomplete`. | Lokalkan. | Fixed 2026-09-06 |
| P3 | `ResetSessionView.vue` mati (tidak ada route). | Tidak ada import di `router/index.ts`. | Pasang route atau hapus file. | Fixed 2026-09-06: `/reset` |
| P3 | Shortcut keyboard event masih minim vs PRD FR-10. | `CameraView` hanya `Escape`. | Space = capture, Esc = batal countdown. | Fixed 2026-09-06 |

### Temuan lama yang ditutup di kode

- P2 retake upload ke `/config` tanpa `source=upload`: **Fixed** (`ReviewView` `query: { source: previousSource }`).
- P2 icon-only tanpa nama: **Fixed** untuk kamera/config/upload/gallery/booth (ada `aria-label`).
- P3 copy gallery/update Inggris: **Fixed** (`Hapus photo strip ini?`, `Update Tersedia`).
- P2 output sukses palsu: tetap **Fixed**.

### Batasan

- Chrome/Safari fisik belum dijalankan.
- WebKit offline upload/render tetap perlu device Safari.
- Live Cam end-to-end dan print/share capability tidak di-stres di pass ini.
- Booth lintas NAT/TURN di luar cakupan implementasi saat ini.

---

## Bugfix pass 2026-09-06

Perbaikan temuan deep scan fungsional:

- Preview kamera menempelkan stream setelah `<video>` mount, lalu `play()`.
- `ensureSession` membuat sesi baru jika layout/template/slot/source berubah; back kamera menghapus sesi incomplete.
- Review/render tidak lagi mengambil sesi orang lain jika sesi aktif belum lengkap.
- Capture dikunci sampai save selesai; kelengkapan memakai order unik; render memakai `shot.order`.
- Error render tampil di review (Bahasa Indonesia).
- Gallery bisa buka `/output?renderId=` dan unduh Live Cam.
- Upload menerima alias MIME JPEG dan ekstensi file; file picker cancel tidak menggantung.
- Share cancel tidak dilaporkan sebagai browser tidak mendukung.
- Booth copy menjelaskan tab yang sama; peer ke-3 ditolak; compose ada timeout.
- Guest WebRTC retry sampai host online; timeout ICE 25 detik.
- File picker tidak membatalkan pilihan sah dalam 800ms.
- `/review` tanpa session id tidak memuat strip sesi lain.
- Download output tidak merender ulang dari shot yang sudah dihapus.

Verifikasi: `npm run typecheck`, `npm run lint`, `npm run test` (55), Playwright Chromium `process-qa` + `camera-config-visual` termasuk `video.srcObject`/`videoWidth`.

---

## Bugfix pass 2026-09-06 (sisa temuan)

Perbaikan yang sebelumnya masih mitigasi:

- File picker tidak lagi membatalkan pilihan sah lewat timeout focus. `onchange` selalu menang; cancel hanya dari event `cancel` atau gesture user setelah picker tertutup tanpa file.
- Config upload/kamera disimpan ke `sessionStorage` dan dikonsumsi sesuai source, termasuk reload `/upload` dan blanko custom.
- Kamera memuat blanko custom dari IndexedDB sebelum `ensureSession`.
- Render blanko custom membaca asset IndexedDB; gagal load tidak lagi jatuh ke blanko generated.
- Booth guest tidak memutus koneksi setelah 25 detik. Kode valid tanpa host tetap menunggu.
- Host PeerJS mengulang ID sampai berhasil atau user keluar; WebRTC dipasang ulang jika signaling gagal.
- Guest bisa mengulang pose yang sama; start-moment duplikat dari dua transport diabaikan; replay hanya untuk peer baru dan moment yang belum composed.
- Waiter countdown/start di-reject saat dispose; still WebRTC dikirim sebagai frame biner.
- Status booth tidak menimpa “strip siap” setiap 400ms.
- Print memakai iframe same-origin, tanpa `window.open` dan tanpa inline `onload`.

---

## Bugfix pass 2026-09-16

Iterasi QA terhadap alur kamera, upload, render, output, gallery, dan Booth Bareng. Perbaikan yang masuk kode:

| Severity | Temuan | Perbaikan | Status |
|---|---|---|---|
| P1 | Still kamera diambil ~450ms setelah flash karena menunggu trailer Live Cam, sehingga pose sudah lepas. | Capture frame segera saat flash, lalu hentikan Live Cam; shot memakai still yang sudah diambil. | Fixed |
| P1 | Reload `/upload` menghilangkan layout/slot/blanko karena pending config di-consume di mount pertama. | Pending config dibaca tanpa dihapus; `persistActiveSessionId(null)` tidak lagi mengosongkan pending. | Fixed |
| P1 | Back setelah render membuka review/render kosong karena shot sudah dihapus. | Session selesai diarahkan ke `/output?renderId=`; `/render` memakai `replace`. | Fixed |
| P2 | Query `?role=host` bisa merampas peran host Booth. | Host hanya dari `sessionStorage` yang di-set saat Buka Booth. | Fixed |
| P2 | Peer ke-3 tetap mendapat koneksi WebRTC; still bisa memakai role palsu. | Host hanya menjaga 1 koneksi tamu; still memakai role handshake. | Fixed |
| P2 | Overlay wajah hilang di PNG/Live Cam jika deteksi wajah kosong. | Render slot memakai fallback face bounds. | Fixed |
| P2 | Retake index stale menempel di sesi baru; switch kamera bisa bocor stream. | `startSession` menghapus retake index; switch/unmount memakai generation token. | Fixed |
| P2 | Framing JPEG iPhone tidak mengikuti EXIF; blanko 3-tepi dan MIME kosong ditolak. | Preview/framing memakai gambar berorientasi; window 3-tepi yang cukup besar tetap diterima; ekstensi PNG/WebP diterima. | Fixed |
| P2 | Filename output mengabaikan metadata render; sesi selesai terhapus saat Foto Baru. | Output memakai layout/template/mime render; Foto Baru hanya membuang sesi incomplete. | Fixed |
| P3 | Copy galeri `Download`, landing delay 4 detik, `_headers` tidak noindex booth. | Unduh, mount Vue segera, noindex `/booth` `/j/*` `/reset`. | Fixed |

### Verifikasi

- `npm run typecheck` passed
- `npx vue-tsc -b --noEmit` passed
- `npm run lint` passed
- `npm run test` passed: 71 tests
- Playwright Chromium: `app`, `booth`, `upload-render`, `camera-config-visual`, `process-qa` passed

### Masih terbuka / di luar pass ini

- Precache PWA masih memuat frame efek kamera di first visit.
- Prompt update PWA belum ditahan selama sesi capture/render.
- Overlay custom blanko non-4:3 belum di-remap ke crop cover.
- Booth lintas NAT/TURN dan device fisik Safari/Chrome belum diverifikasi.

---

## Follow-up pass 2026-09-16

| Severity | Temuan | Perbaikan | Status |
|---|---|---|---|
| P2 | First-visit PWA precache menelan ratusan frame Kicau Mania/Windut. | Frame animasi overlay tidak ikut precache; di-cache CacheFirst saat overlay dipakai. | Fixed |
| P2 | Prompt update bisa reload di tengah capture/review/render/output/booth. | Prompt ditahan sampai route/sesi idle, sesuai policy teknis §11.3. | Fixed |
| P2 | Overlay wajah meleset di blanko custom yang slotnya bukan 4:3. | Bounds di-remap lewat crop cover yang sama dengan foto di slot. | Fixed |
| P2 | Booth lintas NAT gagal diam-diam. | STUN tambahan, copy jaringan, timeout 20 detik, dan tombol coba hubungkan lagi. TURN server tetap tidak ditambah (bukan dependency wajib v1). | Superseded |

Device fisik Safari/Chrome dan NAT simetris tetap perlu QA lapangan; tidak ada server TURN di v1.

---

## Booth lintas jaringan 2026-09-16

| Severity | Temuan | Perbaikan | Status |
|---|---|---|---|
| P1 | Booth Bareng gagal 4G vs Wi-Fi kantor; UI menyuruh pakai jaringan yang sama atau hotspot. | Mailbox HTTPS ephemeral terenkripsi di origin, STUN port 80/443, ICE 20 detik, CSP `stun:`/`turn:`/`turns:`. Copy hotspot/4G dihapus. | Fixed |

### Verifikasi follow-up

- `npm run typecheck` passed
- `npm run lint` passed
- `npm run test` passed: 75 tests
- `npm run build` passed; PWA audit passed (frame overlay tidak ikut precache)
- Playwright Chromium: `app`, `booth`, `camera-config-visual`, `process-qa` passed

---

## Spacing audit 2026-09-16

Audit visual desktop 1280 dan mobile 390 di semua route utama. Temuan dan perbaikan:

| Severity | Temuan | Perbaikan | Status |
|---|---|---|---|
| P2 | `ui.content` tidak punya padding atas, jadi config/upload/review/output/booth/privacy menempel ke header atau progress. | Content memakai `pt-5 pb-8 sm:pt-6` di seluruh halaman flow. | Fixed |
| P2 | `mt-auto` di aksi bawah mendorong tombol ke dasar viewport dan meninggalkan rongga besar di review/output. | `mt-auto` dihapus dari token aksi; stack konten memakai `gap-6`. | Fixed |
| P2 | Landing desktop memusatkan hero di sisa viewport (`align-content: stretch` + `items-center`), sehingga jarak atas-bawah tidak merata. | Grid landing memakai `content-start` dan padding halaman yang sama. | Fixed |
| P3 | Kartu blanko config membungkus angka slot (2/3/4 terpisah dari 6). | Isi kartu jadi kolom: preview+teks di atas, angka slot full-width di bawah. | Fixed |
| P3 | Empty review menampilkan strip placeholder + error + CTA yang tidak relevan. | Empty state terpusat dengan CTA `Mulai Foto`. | Fixed |
| P3 | Padding panel, section intro, footer, dan kluster kontrol kamera tidak satu skala. | Token `stack`/`sectionIntro`, panel `p-4`, footer `gap-x-5 gap-y-2`, kontrol kamera tanpa margin negatif. | Fixed |

