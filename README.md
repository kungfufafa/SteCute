# Stecute

Index dokumentasi proyek ada di [docs/README.md](./docs/README.md).

## Development

Jalankan dev server biasa:

```bash
npm run dev
```

Jalankan dev server HTTPS yang bisa dibuka dari device lain di jaringan lokal:

```bash
npm run dev:https
```

Script ini membuat sertifikat lokal di `.certs/`, menjalankan Vite dengan `https://0.0.0.0:5173`, dan menampilkan URL LAN seperti `https://192.168.x.x:5173/`.

Untuk kamera di mobile browser, HP harus trust CA lokal dari `.certs/stecute-dev-ca.crt`:

- iOS: kirim file CA ke device, install profile, lalu aktifkan full trust di Certificate Trust Settings.
- Android: install sebagai CA certificate dari pengaturan Security/Encryption & credentials.

Jika IP Wi-Fi berubah, jalankan ulang `npm run dev:https`; sertifikat server akan dibuat ulang dengan IP terbaru. Folder `.certs/` bersifat lokal dan tidak boleh di-commit.

Dokumen utama:

- [PRD](./docs/stecute-prd.md)
- [Technical Design](./docs/stecute-technical-design.md)
- [Production Spec](./docs/stecute-production-spec.md)
- [Asset Spec](./docs/stecute-asset-spec.md)
- [Release Checklist](./docs/stecute-release-checklist.md)
- [Prototype](./docs/stecute-prototype.html)
