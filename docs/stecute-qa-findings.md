# Stecute QA Findings

Tanggal: 2026-05-02

## Cakupan real browser

- Chromium desktop
- Mobile Chrome emulation
- Mobile Safari emulation
- Alur: landing, konfigurasi sesi, upload invalid, upload valid 4 foto, review, kustomisasi teks, render output, galeri lokal, dan fallback route

## Temuan dan status

| Severity | Temuan | Perbaikan | Status |
|---|---|---|---|
| P1 | Mobile Safari gagal lanjut dari upload ke review setelah memilih 4 file valid. Error browser: `UnknownError: Error preparing Blob/File data to be stored in object store`. | Persistence layer tetap menulis Blob lebih dulu, lalu retry sebagai ArrayBuffer binary jika IndexedDB browser menolak Blob/File. Data dibaca kembali sebagai Blob oleh API aplikasi. | Fixed |
| P2 | Pesan validasi upload masih campuran bahasa Inggris. | Pesan validasi file kosong, format tidak didukung, dan batas 10 MB dilokalkan ke Bahasa Indonesia. | Fixed |
| P2 | Tab kustomisasi berbasis ikon tidak punya accessible name yang stabil untuk browser automation dan pembaca layar. | Tombol tab diberi `aria-label` sesuai label tab. | Fixed |

## Verifikasi

- `npm run typecheck` passed
- `npm run lint` passed
- `npm run test` passed: 4 tests
- `npm run test:e2e` passed: 21 tests di Chromium, Mobile Chrome, dan Mobile Safari
- `npm run build` passed
