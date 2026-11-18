# Stecute Docs Index

Dokumentasi proyek sengaja dijaga minimal: satu spesifikasi, satu prototype.

## Isi folder

- [stecute-spec.md](./stecute-spec.md) — **satu-satunya sumber kebenaran tertulis**: produk, alur inti, aturan fungsional yang benar-benar diimplementasikan, arsitektur teknis, inventaris aset, dan roadmap yang belum dibangun.
- [stecute-prototype.html](./stecute-prototype.html) — referensi visual UI. Bukan sumber kebenaran perilaku; spec menang bila berbeda.

## Konvensi drift report

- Audit docs-vs-code menghasilkan file `YYYY-MM-DD_DRIFT_REPORT.md` di root repo (mis. `2026-11-18_DRIFT_REPORT.md`).
- Report adalah artefak audit bertanggal, bukan dokumen living; jangan dijadikan acuan implementasi jangka panjang.
- Setelah temuan audit dibereskan (kode atau spec diperbaiki), update `stecute-spec.md` agar kembali mencerminkan realitas kode.

## Aturan main

- Perubahan perilaku produk/teknis → update `stecute-spec.md` di perubahan yang sama.
- Jangan menambah dokumen spekulatif baru; masukkan rancangan yang belum dibangun ke bagian Roadmap di spec.
- Jika spec dan kode berbeda, kode adalah realitas — perbaiki spec (atau kodenya bila itu bug), dan catat lewat drift report berikutnya.