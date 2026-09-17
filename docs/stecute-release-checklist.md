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
- Accessibility review selesai
- Asset spec final selesai

## 3. Engineering

- Lint pass
- Typecheck pass
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
- Preset filter kamera pass di preview dan hasil render final
- Preset overlay kamera pass di preview kamera, review, dan hasil render final
- Latar virtual solo flow (Asli, Pink, Biru, Ungu, Mint, Krem, Putih, Blur, dan Upload Gambar) tampil konsisten di preview, review, render final PNG, dan Live Cam
- Pilihan latar virtual terkunci setelah capture dimulai, dan retake per-shot mempertahankan latar aktif
- Booth Bareng: latar virtual pilihan host (termasuk gambar kustom) diterapkan ke kedua peserta (`host | tamu`) tanpa segmentasi ulang di sisi tamu
- Booth Bareng: badge status persiapan latar tamu dan countdown gating pass (menunggu kedua peer siap)
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
