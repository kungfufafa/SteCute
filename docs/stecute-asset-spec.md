# Spesifikasi Asset - Stecute

Dokumen: Asset Specification  
Versi: 1.0  
Tanggal: 2026-03-20  
Status: Finalized baseline untuk asset produksi  
Pemilik dokumen: Design + Product + Frontend

---

## 1. Tujuan

Dokumen ini mendefinisikan asset visual dan non-code yang wajib tersedia untuk rilis produksi v1.

Asset di dokumen ini harus dianggap source of truth untuk:

- inventory asset
- format file
- budget ukuran
- struktur folder
- bundling offline
- lisensi dan ownership

---

## 2. Struktur folder asset

Rekomendasi struktur:

```text
src/assets/
  icons/
  frames/
  templates/
    classic/
    youth/
    mono/
  layouts/
  fonts/
public/
  manifest/
  app-icons/
```

---

## 3. Aturan umum asset

### 3.1 Format file

- icon UI: `SVG`
- frame raster: `PNG`
- template preview kecil: `WebP` atau `PNG`
- app icon PWA: `PNG`
- font: `WOFF2`

### 3.2 Aturan kualitas

- semua asset harus tajam pada retina display
- semua asset harus aman dipakai offline
- semua asset harus punya nama file stabil dan deskriptif
- semua asset harus lolos review lisensi
- blanko raster harus punya photo window transparan atau layer overlay terpisah; placeholder warna solid hanya boleh dipakai sebagai panduan produksi, bukan asset final yang langsung dirender
- custom blanko dari user wajib PNG atau WebP lokal dengan alpha channel; JPG tidak diterima untuk blanko karena tidak bisa membawa window transparan
- custom blanko upload disimpan sebagai asset Blob di IndexedDB dan direferensikan sebagai template lokal reusable di browser/perangkat yang sama

### 3.3 Aturan ukuran

- satu frame file target `< 250 KB`
- satu template preview target `< 80 KB`
- total frame dan template visual target `< 2 MB`
- total font target `< 500 KB`
- total bundled visual asset target `< 8 MB`

---

## 4. Template asset inventory

### 4.1 Template wajib v1

- `classic`
- `youth`
- `mono`

### 4.2 Template spec minimum

Setiap template harus memiliki:

- config JSON
- preview thumbnail
- background style
- frame asset utama bila ada
- label style
- fallback color palette
- daftar layout yang didukung bila template tidak cocok untuk semua layout
- slot coordinate per layout bila memakai blanko raster dengan artboard khusus
- untuk custom upload, jumlah window transparan menjadi jumlah slot layout custom

### 4.3 Template decisions

#### Classic

- gaya: clean analog strip
- background: off-white
- frame: soft neutral
- tone: warm casual

#### Youth

- gaya: playful modern
- background: vibrant
- frame: colorful
- tone: energetic

#### Mono

- gaya: grayscale minimal
- background: dark neutral
- frame: minimal
- tone: formal atau nostalgic

#### Raster blanko sample lokal

- Sample raster di `public/templates/` tidak otomatis menjadi template aktif.
- Template raster baru harus didaftarkan lewat config eksplisit atau diunggah sebagai custom template lokal.
- Sebelum rilis publik, nama file sample harus diganti menjadi stabil dan status lisensi/ownership harus dikonfirmasi.

---

## 5. Layout asset inventory

Layout wajib v1:

- `strip-2-vertical`
- `strip-3-vertical`
- `strip-4-vertical`
- `strip-6-vertical`

Setiap layout harus memiliki:

- config JSON
- thumbnail preview
- slot metadata
- canvas size metadata

---

## 6. Camera filter inventory

Preset filter kamera masuk v1 sebagai konfigurasi lokal statis. Filter dipilih sebelum capture, tampil di preview kamera, dan diterapkan kembali oleh render engine saat membuat hasil akhir.

### 6.1 Filter v1

- `normal`
- `bw`
- `noir`
- `warm`
- `cool`
- `vintage`
- `fade`
- `film`
- `rosy`
- `pop`
- `instant`
- `dream`

### 6.2 Filter implementation rule

- filter final harus diterapkan via render engine, bukan gambar preview statis
- preview filter boleh memakai CSS swatch lokal atau thumbnail asset kecil
- filter tidak boleh bergantung pada layanan eksternal

---

## 7. Camera overlay inventory

Preset overlay kamera masuk v1 sebagai konfigurasi lokal statis. Overlay dipilih sebelum capture, tampil di preview kamera saat wajah terdeteksi, muncul di preview review, dan digambar ulang oleh render engine saat membuat hasil akhir jika shot memiliki `faceBounds`.

Overlay v1 tidak memakai asset remote dan tidak membuka editor sticker manual pasca-capture.
Preset `hearts` memakai sprite PNG lokal dari `src/assets/camera-effects/hearts/`.
Preset `bluebirds` memakai sprite PNG lokal dari `src/assets/camera-effects/bluebirds/`.
Keduanya disalin dari `/System/Applications/Photo Booth.app/Contents/Resources/`.
Status lisensi asset Photo Booth harus dikonfirmasi sebelum distribusi publik di luar
perangkat/deployment yang berhak memakai asset tersebut.
Preset `kicau-mania` memakai frame PNG lokal hasil split GIF di
`src/assets/camera-effects/kicau-mania/`. Sumber awal berasal dari export `ezgif-split`
untuk GIF scuba dance; status lisensi/ownership harus dikonfirmasi sebelum distribusi publik.

### 7.1 Overlay v1

- `none`
- `hearts`
- `bluebirds`
- `kicau-mania`

### 7.2 Overlay implementation rule

- overlay final harus digambar via render engine pada setiap slot foto
- preview kamera dan preview review memakai canvas lokal dengan sumber gambar bitmap bundled yang sama
- face detection untuk overlay memakai MediaPipe runtime asset lokal dari `public/vendor/mediapipe/`, termasuk WASM tasks-vision dan model `blaze_face_short_range.tflite`; tidak boleh memuat model atau WASM dari CDN saat production
- `hearts` memakai mekanik lovestruck: hati muncul dari area sekitar kepala, mengambang naik, lalu fade/scale dalam loop
- `bluebirds` memakai mekanik dizzy: `8` burung mengorbit area atas kepala dalam lintasan elips, arah sprite mengikuti tangent gerak, dan frame sayap memakai urutan `0-3`
- `kicau-mania` memakai mekanik dance loop: frame PNG lokal melompat kecil di area atas kepala dengan frame sprite urutan `0-52`, tanpa elemen heart tambahan
- animasi overlay di preview kamera harus dapat dibekukan sebagai snapshot per-shot, sehingga posisi dan fase visual yang dirender final tetap sesuai momen capture
- overlay tidak boleh bergantung pada layanan eksternal
- overlay default tidak boleh menutupi lebih dari `25%` area foto

### 7.3 Face detector runtime assets

Asset runtime face detector wajib tersedia lokal:

- `public/vendor/mediapipe/tasks-vision/wasm/vision_wasm_internal.js`
- `public/vendor/mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm`
- `public/vendor/mediapipe/tasks-vision/wasm/vision_wasm_nosimd_internal.js`
- `public/vendor/mediapipe/tasks-vision/wasm/vision_wasm_nosimd_internal.wasm`
- `public/vendor/mediapipe/models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite`

Asset ini adalah dependency runtime non-visual dan dihitung terpisah dari budget visual `< 8 MB`.
Provenance, versi package, sumber model, ukuran file, dan SHA-256 setiap file wajib dicatat di
`public/vendor/mediapipe/manifest.json`; audit PWA harus gagal jika file vendor tidak cocok dengan
manifest tersebut.

---

## 8. Deferred sticker inventory

Sticker manual tidak menjadi asset wajib v1 process-first. Jika kustomisasi diaktifkan kembali, starter pack berikut dapat dipakai sebagai baseline.

### 8.1 Starter pack fase berikutnya

- `4` playful shapes
- `4` stars or sparkles
- `2` hearts
- `2` flowers
- `2` speech or doodle accent
- `2` celebration elements

### 8.2 Sticker constraints fase berikutnya

- maksimum sticker aktif pada satu render: `5`
- semua sticker harus PNG transparan
- rasio asli sticker harus dijaga
- tidak boleh ada elemen yang menutupi lebih dari `25%` area foto per sticker default size

---

## 9. Frame and template overlay inventory

### 9.1 Frame inventory

Frame minimum v1:

- `classic-light`
- `classic-cream`
- `youth-pink`
- `youth-blue`
- `mono-light`
- `mono-dark`

### 9.2 Template overlay rules

- template overlay hanya untuk treatment ringan
- template overlay tidak boleh mengurangi keterbacaan foto
- opacity default template overlay maksimum `20%`

---

## 10. Font policy

### 10.1 Font production

Font harus self-hosted.

Pilihan v1:

- primary UI: `Poppins`
- fallback: `system-ui`, `sans-serif`

### 10.2 Font files

Self-host subset:

- regular `400`
- medium `500`
- semibold `600`
- bold `700`

Tidak boleh bergantung pada `fonts.googleapis.com` atau CDN lain di production.

---

## 11. PWA and app icons

Wajib tersedia:

- `192x192`
- `512x512`
- maskable icon `512x512`
- favicon
- apple touch icon `180x180`

Semua icon harus konsisten dengan brand dasar Stecute v1.

---

## 12. Ownership and licensing

Semua asset harus punya status jelas:

- dibuat internal
- dibeli dengan lisensi komersial
- open license yang kompatibel

Setiap asset pack wajib punya metadata:

- source
- author
- license type
- date added
- approver

Tidak ada asset tanpa provenance yang boleh masuk production.

---

## 13. Asset manifest

Setiap asset bundled harus masuk manifest JSON minimal dengan field:

- `id`
- `type`
- `name`
- `path`
- `packId`
- `version`
- `checksum`
- `license`

---

## 14. Release checklist asset

Sebelum rilis:

- semua asset ada di manifest
- semua asset lolos review lisensi
- semua asset lolos budget ukuran
- semua asset tampil benar di offline mode
- semua preview cocok dengan hasil akhir
- tidak ada font remote
