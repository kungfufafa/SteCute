# Release Checklist - Production Ready

Dokumen: Release Checklist  
Versi: 1.0  
Tanggal: 2026-03-20

---

## 1. Produk

- Scope v1 terkunci
- Semua open question sudah diputuskan
- Copy landing, error, dan privacy final
- Copy SEO halaman publik final
- Support contact tersedia

## 2. Desain

- Semua screen state final
- Responsive desktop, tablet, mobile final
- Capture Solo/Duet: mulai lebar `1024 px`, preview dan panel kontrol berdampingan dengan konten maksimum `1600 px`; lebar di bawahnya memakai satu kolom tanpa overflow horizontal
- Capture Solo/Duet: pada desktop pendek, pengaturan dapat di-scroll sementara aksi utama tetap dapat dijangkau; pada ponsel/tablet, scroll halaman menjangkau preview, aksi, dan semua pengaturan
- Preview kamera tetap `4:3` tanpa gambar meregang; tata layar baru tidak mengubah crop, mirror, overlay, countdown, atau hasil capture
- Accessibility review selesai
- Asset spec final selesai

## 3. Engineering

- Lint pass
- Typecheck pass melalui `vue-tsc -b --noEmit` agar project references aplikasi benar-benar diperiksa
- Unit test pass
- Integration test pass
- E2E smoke pass
- PWA artifact audit pass
- PWA installable
- Offline relaunch pass
- Live Cam capture/output pass pada browser yang mendukung `MediaRecorder`; PNG fallback pass saat capability tidak tersedia
- MediaPipe face detector WASM/model tersedia lokal, ikut precache, dan cocok dengan manifest checksum vendor
- MediaPipe image segmenter model (`selfie_segmenter.tflite`) tersedia lokal 100% offline tanpa CDN
- Pipeline latar virtual Web Worker stabil dengan main-thread fallback dan confidence mask rendering halus
- Normalisasi upload latar kustom (maks 1600px, maks 512 KiB JPEG, background putih, SHA-256) pass
- WebRTC DataChannel chunking dan background sync pass di Booth Bareng
- Booth Bareng: suara mikrofon terdengar di tile teman; video lokal tetap mute; fallback ketuk-untuk-dengar jika autoplay diblokir
- Booth Bareng: host dan tamu masing-masing bisa mute/nyalakan mikrofon serta matikan/nyalakan suara teman; kontrol tetap tersedia selama menunggu, capture, review, dan hasil
- Booth Bareng: mikrofon ditolak tetap memungkinkan foto; retry audio-only tidak mengulang kamera atau menghapus foto, dan request audio terlambat setelah keluar ruang menghentikan track
- Booth Bareng: mute mikrofon menghentikan suara keluar, mute suara teman hanya memengaruhi playback lokal, pilihan mute bertahan saat pergantian tahap/pemulihan stream, dan audio tidak ikut dalam ekspor Live Cam
- Reactions gesture tetap hidden/deferred dan tidak masuk daftar overlay v1
- Storage cleanup pass (termasuk pembersihan asset `virtual-background` saat session complete/reset/stale)
- Service worker update flow aman
- SEO metadata, robots, sitemap, dan canonical public routes pass

## 4. Security

- HTTPS aktif
- CSP aktif
- Permissions-Policy aktif
- Font self-hosted
- Tidak ada runtime CDN untuk MediaPipe face tracking maupun selfie segmentation
- Tidak ada remote script non-esensial

## 5. QA

- Chrome desktop pass
- Edge desktop pass
- Chrome Android physical device pass
- Safari iPhone/iPad physical device pass
- Unsupported browser flow pass
- Error states pass
- Upload: Back dari review dan reload memulihkan foto asli serta framing; penggantian per-shot ikut dipulihkan dan draft dibersihkan setelah selesai
- Render: meninggalkan layar tidak mengambil alih navigasi, menghapus draft baru, atau memakai kembali job yang sudah dibatalkan
- Output: galeri penuh tetap menyediakan preview/unduh PNG dengan status belum tersimpan; hasil yang dihapus dari galeri tidak muncul kembali dari cache
- Kamera: request terlambat setelah keluar halaman menghentikan track; gagal switch kamera tetap memungkinkan capture setelah fallback
- Tata layar capture: uji desktop lebar, laptop pendek, batas breakpoint `1024 px`, tablet, dan ponsel; tombol capture/batal, efek, pemilihan kamera, dan kontrol audio Duet dapat dijangkau tanpa terpotong
- Pengaturan sesi di kamera Solo/Duet: sebelum foto pertama, panel dapat dibuka/tutup; frame, jumlah pose/layout, timer `3`/`5`/`10`, dan Otomatis memakai draft; `Batal` mempertahankan konfigurasi, sedangkan `Terapkan` tidak mengulang kamera atau memutus ruang/audio
- Pengaturan sesi: setelah foto pertama, frame, jumlah pose/layout, timer, Otomatis, efek, overlay, dan latar semuanya terkunci, termasuk saat retake per-shot; kontrol audio pribadi tetap tersedia
- `Ulang semua foto`: aksi terpisah meminta konfirmasi, pembatalan mempertahankan foto/config, dan konfirmasi menghapus seluruh shot/klip serta membuka kembali pengaturan sambil mempertahankan config/latar/kamera; hanya host mereset kedua peserta Duet dalam ruang yang sama tanpa memutus audio
- Pengaturan sesi: hanya host dapat mengubah setup Duet; tamu menerima setup yang diterapkan; perubahan juga diblokir selama countdown/capture/apply; penerapan konfigurasi tidak digabung dengan reset foto
- Duet: kontrol mikrofon dan suara teman tersedia bagi host/tamu di panel capture serta tetap tersedia di review dan hasil setelah perubahan layout
- Preset filter kamera pass di preview dan hasil render final
- Preset overlay kamera pass di preview kamera, review, dan hasil render final
- Latar virtual solo flow (Asli, Pink, Biru, Ungu, Mint, Krem, Putih, Blur, dan Upload Gambar) tampil konsisten di preview, review, render final PNG, dan Live Cam
- Pilihan latar virtual terkunci setelah capture dimulai, dan retake per-shot mempertahankan latar aktif
- Booth Bareng: latar virtual pilihan host (termasuk gambar kustom) diterapkan ke kedua peserta (`host | tamu`) tanpa segmentasi ulang di sisi tamu
- Booth Bareng: badge status persiapan latar tamu dan countdown gating pass (menunggu kedua peer siap)
- Booth Bareng: kamera kedua peserta wajib siap; mulai pose terkunci selama encoding dan pertukaran still
- Booth Bareng: still/start/cancel tertunda dari percobaan lama tidak mengubah retake baru dan tidak menghasilkan pasangan foto berbeda
- Booth Bareng: timeout 10 detik atau kegagalan transfer latar membatalkan countdown dan memunculkan modal recovery ("Coba Lagi" / "Gunakan Asli bersama")
- Live Cam download pass untuk session kamera dan tidak muncul untuk upload/local unsupported flow
- Tidak ada entry point Reactions di UI produksi v1

## 6. Operasional

- Production build disimpan
- Production URL untuk SEO canonical dan sitemap sudah benar
- Rollback plan siap
- Monitoring aktif
- Legal pages aktif

## 7. Go/No-Go

Release hanya `GO` jika tidak ada blocker severity tinggi.
