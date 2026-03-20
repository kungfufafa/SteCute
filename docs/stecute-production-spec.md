# Spesifikasi Production-Ready - Stecute

Dokumen: Production Readiness Specification  
Versi: 1.0  
Tanggal: 2026-03-20  
Status: Finalized baseline untuk implementasi production-ready  
Pemilik dokumen: Product + Engineering + Design + QA

---

## 1. Tujuan dokumen

Dokumen ini melengkapi PRD dan rancangan teknis yang sudah ada agar tim dapat:

- memulai implementasi tanpa blocker spesifikasi besar
- mengurangi ambiguitas produk, desain, dan engineering
- memiliki kriteria siap rilis yang operasional
- memiliki baseline yang cukup untuk menuju production release

Dokumen ini mengunci keputusan yang sebelumnya masih terbuka. Jika ada perubahan setelah implementasi berjalan, perubahan harus dibuat melalui changelog keputusan dan bukan asumsi lisan.

---

## 2. Keputusan final scope rilis

### 2.1 Target rilis

Target rilis pertama adalah `Production MVP`, yaitu produk publik yang stabil untuk:

- penggunaan personal
- penggunaan event skala kecil hingga menengah
- perangkat browser modern

### 2.2 Fitur yang masuk rilis produksi v1

Fitur yang wajib ada:

- landing page dan app shell
- alur kamera dan upload lokal
- format cetak `2x6` untuk varian `2 foto`, `3 foto`, `4 foto`, dan `6 foto`
- template bawaan `Classic`, `Youth`, `Mono`
- countdown `3`, `5`, `10` detik
- review sesi
- retake `seluruh sesi`
- retake `per-shot` sebelum render final
- filter dasar bundled offline
- frame color dasar
- sticker pack dasar bundled offline
- toggle `date/time`
- input `logo text` sederhana
- render final `PNG` dan `JPG`
- download lokal
- save to device jika capability tersedia
- share jika capability tersedia
- print ringan jika capability tersedia
- gallery lokal `10 hasil terakhir`
- reset session
- offline mode setelah first load berhasil cache
- error states utama

### 2.3 Fitur yang tidak masuk rilis produksi v1

Tidak masuk v1:

- login
- cloud sync
- upload ke server
- QR handoff
- GIF export
- preset branding event remote
- marketplace template
- pembayaran
- kiosk native wrapper

### 2.4 Keputusan open questions yang dikunci

- `Preset event dasar` tidak masuk rilis v1. Masuk fase berikutnya.
- `Print ringan` adalah capability bonus, bukan blocker rilis.
- `Gallery lokal` menyimpan final render. Raw shots disimpan hanya selama sesi aktif dan dibersihkan saat retake, reset, atau retention cleanup.
- `Sticker pack awal` dibatasi untuk menjaga performa. Detail ada di dokumen asset.
- `Auto-reset event` tidak masuk v1. Reset manual wajib ada.

---

## 3. User flow final

### 3.1 Flow kamera

1. User membuka aplikasi.
2. User menekan `Mulai Foto`.
3. App meminta izin kamera saat masuk flow kamera.
4. User dapat mengganti layout, template, countdown, dan kamera aktif sebelum capture.
5. App menjalankan capture berurutan sesuai slot layout.
6. User dapat retake per-shot dari layar review sebelum render final.
7. User dapat lanjut ke kustomisasi.
8. User melakukan render final.
9. User memilih `Download`, `Save`, `Share`, atau `Print` sesuai capability browser.
10. Session dapat di-reset untuk sesi baru.

### 3.2 Flow upload lokal

1. User membuka aplikasi.
2. User memilih `Upload Lokal`.
3. App meminta file sesuai jumlah slot layout aktif.
4. App memvalidasi format, ukuran, dan jumlah file.
5. User masuk ke review.
6. User dapat hapus dan ganti per-shot.
7. User lanjut ke kustomisasi.
8. App render final.
9. User memilih output action yang tersedia.

### 3.3 Flow error

Error utama yang wajib ditangani:

- kamera ditolak
- kamera tidak ada
- stream gagal
- file upload tidak valid
- render gagal
- quota storage penuh
- browser tidak didukung
- first visit saat offline

Setiap error wajib memiliki:

- judul yang jelas
- penjelasan non-teknis
- aksi utama
- aksi fallback bila ada

---

## 4. Spesifikasi output final

### 4.1 Format output

- Default export: `PNG`
- Optional export: `JPG`
- JPEG quality default: `0.9`

### 4.2 Ukuran canvas output

Baseline output:

- `2 foto`: `1200 x 3600`
- `3 foto`: `1200 x 3600`
- `4 foto`: `1200 x 3600`
- `6 foto`: `1200 x 3600`

App boleh menurunkan ukuran pada device lemah dengan aturan berikut:

- fallback medium: `1000 px` sisi pendek
- fallback low-memory: `900 px` sisi pendek

### 4.3 Naming file

Format nama file:

`stecute-YYYYMMDD-HHmmss-layout-template.ext`

Contoh:

`stecute-20260320-154530-2x6-classic-strip-classic.png`

### 4.4 Print intent

Print flow bersifat browser-assisted, bukan print driver native.

Aturan:

- sediakan print stylesheet khusus
- preview print harus memakai background dan margin final
- jika browser mengabaikan background print, tampilkan warning singkat sebelum `window.print`

---

## 5. Batasan upload dan media

### 5.1 Format file yang diterima

- `image/jpeg`
- `image/png`
- `image/webp`

### 5.2 Batas ukuran file

- maksimum `10 MB` per file
- maksimum `6 file` per sesi sesuai layout maksimum

### 5.3 Validasi upload

App harus menolak file jika:

- format tidak didukung
- ukuran melebihi batas
- jumlah file tidak sesuai slot
- file rusak atau gagal decode

### 5.4 Orientation

- metadata orientation harus dinormalisasi saat decode
- preview dan hasil render tidak boleh terbalik

---

## 6. Asset policy

Referensi detail asset ada di dokumen `stecute-asset-spec.md`.

Keputusan produksi:

- semua asset inti wajib bundled dan tersedia offline
- jangan gunakan CDN untuk asset inti
- font produksi harus self-hosted
- tidak boleh ada dependency visual penting yang hanya tersedia online

---

## 7. Browser support matrix final

### 7.1 Browser target rilis

Didukung penuh:

- Chrome desktop `2 versi mayor terakhir`
- Edge desktop `2 versi mayor terakhir`
- Chrome Android `2 versi mayor terakhir`
- Safari iOS/iPadOS `2 versi mayor terakhir`

Didukung best-effort:

- Firefox modern

### 7.2 Capability rules

- `camera capture` wajib di browser target utama
- `upload lokal` wajib di semua browser target
- `download` wajib di semua browser target
- `share` opsional dan capability-based
- `save to device` opsional dan capability-based
- `print` opsional dan capability-based
- `OffscreenCanvas` tidak boleh menjadi dependency wajib

### 7.3 Unsupported browser policy

Jika browser tidak memenuhi syarat minimum:

- tampilkan unsupported screen
- tetap tawarkan upload lokal bila bisa
- tampilkan browser yang direkomendasikan

---

## 8. Performance and device target

### 8.1 Device classes

Device target minimum:

- laptop dual-core modern, RAM `8 GB`
- Android menengah, RAM `6 GB`
- iPhone generasi `3 tahun terakhir`
- tablet menengah modern

### 8.2 Performance target

- app shell interactive: `< 3 detik`
- warm relaunch: `< 2 detik`
- render final default pada laptop menengah: `< 2 detik`
- render final default pada mobile menengah: `< 4 detik`
- reset session: `< 2 detik`
- cleanup gallery `10 render`: `< 1 detik`

### 8.3 Bundle and storage budget

- shell JS gzip target: `< 300 KB`
- total bundled visual asset awal target: `< 8 MB`
- default local gallery cap: `10 render`
- default storage soft warning: `>= 70 MB`

---

## 9. Security and privacy requirements

### 9.1 Security baseline

Wajib:

- HTTPS untuk semua environment non-local
- strict CSP
- Permissions-Policy untuk membatasi camera hanya ke origin sendiri
- tidak ada inline remote script pihak ketiga di production
- semua custom text disanitasi dan dibatasi panjang

### 9.2 CSP baseline

Baseline policy produksi:

- `default-src 'self'`
- `script-src 'self'`
- `style-src 'self' 'unsafe-inline'`
- `img-src 'self' blob: data:`
- `font-src 'self'`
- `connect-src 'self'`
- `worker-src 'self' blob:`
- `media-src 'self' blob:`
- `frame-ancestors 'none'`

Catatan:

- `unsafe-inline` pada style boleh dipertahankan hanya jika build membutuhkan.
- Font Google tidak boleh dipakai di production.

### 9.3 Privacy baseline

- foto tidak dikirim ke server
- analytics default `off` untuk rilis awal publik
- jika analytics diaktifkan di fase depan, hanya event non-image dan harus tercantum di privacy notice
- tombol `Hapus Semua Data` wajib menghapus gallery, setting lokal, dan cache aplikasi yang dapat dihapus oleh app

### 9.4 Input constraints

- `logoText` maksimum `24` karakter
- karakter kontrol dan markup tidak boleh diterima
- sticker aktif maksimum `5`

---

## 10. Data lifecycle and persistence

### 10.1 Retention

- gallery menyimpan `10 render terakhir`
- raw shots dibersihkan setelah render final berhasil, kecuali session aktif masih dibutuhkan untuk review
- session stale lebih dari `24 jam` dibersihkan saat startup

### 10.2 Storage quota handling

Jika estimasi storage melebihi threshold:

- tampilkan warning
- sarankan hapus gallery lama
- jika simpan gagal, jangan hilangkan render di memori sampai user memilih aksi lain

### 10.3 Database versioning

Wajib ada:

- Dexie schema versioning
- migration script untuk perubahan schema
- fallback reset data bila migration gagal dan user menyetujui

---

## 11. UX and accessibility completion rules

### 11.1 State completeness

Design dan implementation wajib memiliki screen atau komponen untuk:

- loading awal
- cache warming
- offline ready
- first visit offline blocked
- permission denied
- no camera
- storage full
- render in progress
- render fail
- unsupported browser
- empty gallery
- delete confirmation

### 11.2 Accessibility baseline

Wajib:

- target tap minimum `44x44 px`
- fokus keyboard terlihat
- heading hierarchy konsisten
- tombol utama punya label tekstual, bukan ikon saja
- kontras minimum `WCAG AA`
- countdown terbaca jelas dari jarak normal

---

## 12. QA and release gates

### 12.1 Automated gates

Sebelum release:

- lint pass
- typecheck pass
- unit test pass
- integration test pass
- Playwright smoke pass
- production build pass

### 12.2 Manual test gates

Wajib lulus pada browser target utama:

- first load online
- reload offline setelah cache
- camera permission allow
- camera permission deny
- upload lokal valid
- upload lokal invalid
- render PNG
- render JPG
- download
- reset session
- delete single gallery item
- delete all local data

### 12.3 Release blockers

Rilis harus ditunda jika:

- camera flow gagal di salah satu browser target utama
- offline relaunch gagal
- render crash rate lebih dari `1%` pada QA run
- data lama tidak bisa dibersihkan
- app menampilkan asset kosong pada first offline run setelah cache sukses

---

## 13. Deployment and operations

### 13.1 Hosting

- gunakan `Cloudflare Pages` sebagai default
- fallback setara: `Netlify`

### 13.2 CI pipeline

Urutan:

1. lint
2. typecheck
3. unit tests
4. integration tests
5. Playwright smoke
6. build
7. deploy preview
8. promote ke production

### 13.3 Rollback strategy

- simpan minimal `1` build production sebelumnya
- rollback dilakukan dengan redeploy build sebelumnya
- jika bug terkait service worker, bump versi service worker dan tampilkan forced refresh hanya saat app idle

### 13.4 Monitoring

Minimal monitoring produksi:

- availability check
- JS runtime errors agregat
- render failure count
- storage quota error count
- unsupported browser rate

Monitoring tidak boleh mengirim foto atau blob gambar.

---

## 14. Legal and support readiness

Sebelum rilis publik, wajib tersedia:

- privacy notice singkat di landing
- halaman kebijakan privasi
- halaman terms of use sederhana
- kontak support atau issue reporting

---

## 15. Definition of release-ready

Produk dianggap `production-ready` jika:

- semua fitur v1 yang tercantum di dokumen ini sudah selesai
- asset spec final sudah dibuat dan semua asset inti tersedia lokal
- browser target utama lulus QA
- offline relaunch lulus
- security baseline aktif
- tidak ada blocker severity tinggi di daftar bug
- release checklist operasional sudah lulus
- legal dan support minimum sudah tersedia
