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
  stickers/
    starter/
  filters/
    previews/
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
- sticker: `PNG` transparan
- preview kecil: `WebP` atau `PNG`
- app icon PWA: `PNG`
- font: `WOFF2`

### 3.2 Aturan kualitas

- semua asset harus tajam pada retina display
- semua asset harus aman dipakai offline
- semua asset harus punya nama file stabil dan deskriptif
- semua asset harus lolos review lisensi

### 3.3 Aturan ukuran

- satu sticker file target `< 150 KB`
- satu frame file target `< 250 KB`
- satu preview filter target `< 80 KB`
- total sticker starter pack target `< 2 MB`
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

## 6. Filter inventory

### 6.1 Filter wajib v1

Minimal `8` filter:

- `normal`
- `bw`
- `warm`
- `cool`
- `vintage`
- `fade`
- `film`
- `rosy`

### 6.2 Filter implementation rule

- filter final harus diterapkan via render engine, bukan gambar preview statis
- preview filter menggunakan thumbnail asset kecil
- filter tidak boleh bergantung pada layanan eksternal

---

## 7. Sticker inventory

### 7.1 Starter pack v1

Starter pack terdiri dari `16` sticker:

- `4` playful shapes
- `4` stars or sparkles
- `2` hearts
- `2` flowers
- `2` speech or doodle accent
- `2` celebration elements

### 7.2 Sticker constraints

- maksimum sticker aktif pada satu render: `5`
- semua sticker harus PNG transparan
- rasio asli sticker harus dijaga
- tidak boleh ada elemen yang menutupi lebih dari `25%` area foto per sticker default size

---

## 8. Frame and overlay inventory

### 8.1 Frame inventory

Frame minimum v1:

- `classic-light`
- `classic-cream`
- `youth-pink`
- `youth-blue`
- `mono-light`
- `mono-dark`

### 8.2 Overlay rules

- overlay hanya untuk treatment ringan
- overlay tidak boleh mengurangi keterbacaan foto
- opacity default overlay maksimum `20%`

---

## 9. Font policy

### 9.1 Font production

Font harus self-hosted.

Pilihan v1:

- primary UI: `Poppins`
- fallback: `system-ui`, `sans-serif`

### 9.2 Font files

Self-host subset:

- regular `400`
- medium `500`
- semibold `600`
- bold `700`

Tidak boleh bergantung pada `fonts.googleapis.com` atau CDN lain di production.

---

## 10. PWA and app icons

Wajib tersedia:

- `192x192`
- `512x512`
- maskable icon `512x512`
- favicon
- apple touch icon

Semua icon harus konsisten dengan brand dasar Stecute v1.

---

## 11. Ownership and licensing

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

## 12. Asset manifest

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

## 13. Release checklist asset

Sebelum rilis:

- semua asset ada di manifest
- semua asset lolos review lisensi
- semua asset lolos budget ukuran
- semua asset tampil benar di offline mode
- semua preview cocok dengan hasil akhir
- tidak ada font remote
