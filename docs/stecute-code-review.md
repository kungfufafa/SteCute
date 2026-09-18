# Review kode dan flow Stecute

Tanggal: 2026-09-18  
Scope: working tree saat review, termasuk perubahan lokal yang sudah ada  
Status: sembilan temuan ditangani dalam working tree; lihat status perbaikan dan verifikasi di bawah

## Status perbaikan

| No. | Perubahan yang diterapkan |
|---|---|
| 1 | `captureId` unik mengikat start, still, komposisi, dan cancel. Paket percobaan lama diabaikan; retake/cancel menghentikan waiter terkait. |
| 2 | Fase capture terpisah dari angka countdown. Mulai pose menunggu kamera lokal/teman dan latar siap; tombol tetap terkunci selama pertukaran still. |
| 3 | Render dibatasi lifecycle dan sesi pemiliknya. Pembatalan juga melindungi draft dari cleanup job lama; job batal tidak dipakai ulang oleh render baru. |
| 4 | Sumber asli upload, urutan, dan framing disimpan sebagai draft lokal. Back/reload dan ganti per-shot memulihkan data yang benar. |
| 5 | Stream dan transport terlambat dihentikan/dispose berdasarkan lifecycle dan generation. |
| 6 | Busy state switch kamera dilepas sebelum setup fallback sehingga shutter kembali bisa digunakan. |
| 7 | Service mengembalikan Blob dan status persistence terpisah. Solo dan Duet tetap menyediakan unduh ketika galeri penuh, dengan status belum tersimpan. Cache hasil tersimpan juga diperiksa terhadap database agar hasil yang dihapus tidak muncul kembali. |
| 8 | Script typecheck memakai `vue-tsc -b --noEmit`; prop label aksesibilitas dan masalah lint yang ditemukan telah diperbaiki. |
| 9 | Pemetaan Render → Hasil hanya berlaku untuk progress compact; progress penuh menandai tahap Render dengan benar. |

Uraian berikut adalah catatan audit **sebelum perbaikan**, termasuk nomor baris dan bukti reproduksi saat itu. Pembagian kode serta penyamaan seluruh fitur Solo/Duet tetap merupakan arah pengembangan, bukan klaim bahwa refactor produk menyeluruh sudah selesai.

## Kesimpulan

Masalah utama berada pada pengelolaan transisi dan kepemilikan sesi. Solo memakai route serta Pinia, sedangkan Duet menjalankan tahap live/review/output melalui state lokal di satu view. Keduanya berbagi render service, tetapi mengelola lifecycle, navigasi, dan output secara terpisah. Perbedaan ini sudah menghasilkan kegagalan konkret pada retake, navigasi kembali, kamera, dan pemulihan hasil.

`BoothRoomView.vue` berisi 2.030 baris dan `CameraView.vue` 1.400 baris pada saat audit. Ukuran bukan alasan tunggal untuk refactor: fungsi pengambilan media, state sesi, koneksi, persistence, dan UI saling mengubah state tanpa satu pengatur transisi yang memastikan operasi lama tidak memengaruhi sesi baru.

Target parity pada [userflow Solo/Duet](./stecute-user-flow.md) adalah rancangan berikutnya. Upload Duet dan frame custom Duet yang belum ada tidak dihitung sebagai bug baseline dalam review ini.

## Temuan prioritas

### 1. [P1] Retake Duet dapat menghasilkan foto berbeda pada kedua peserta

Lokasi: [session.ts](../src/services/booth/session.ts), handler `still` baris 393–410, `clearMoment` 623–628, `submitStill` 814–825. Pengiriman melalui beberapa transport ada di [transport.ts](../src/services/booth/transport.ts) baris 188–189.

- Trigger: pose selesai, host melakukan retake, kemudian duplikat pesan foto lama datang dari jalur yang lebih lambat.
- Foto hanya diidentifikasi dengan `momentIndex` dan peserta, tanpa ID percobaan capture. Pesan lama dapat mengisi kembali map yang baru dikosongkan untuk retake.
- Setelah komposisi terbentuk, `maybeCompose` melewati foto berikutnya. Hasil baru bisa berisi campuran foto dari dua percobaan.
- **Terbukti di browser:** retake ditujukan menjadi hijau/kuning; hasil host hijau/biru lama, hasil tamu hijau/kuning.
- Perbaikan: bawa `captureId` dari countdown sampai still dan composed; terima hanya attempt aktif. Pembatalan dan retake harus membatalkan attempt sebelumnya pada kedua peer.

### 2. [P2] Duet dapat memulai pose berikutnya ketika pengambilan sebelumnya belum selesai

Lokasi: [BoothRoomView.vue](../src/features/booth/BoothRoomView.vue), `canStart` 204–212, `runCountdown` 1024–1026, `captureCurrentMoment` 930–936.

- Setelah countdown mencapai nol, `stopCountdown()` mengosongkan countdown sebelum capture/transfer selesai.
- `canStart` kembali true karena tidak ada state capture/transfer yang menahan tombol. Klik berikutnya memulai slot yang sama dan menghapus data attempt yang masih berjalan.
- Kehadiran teman juga dipakai sebagai prasyarat capture, tetapi kesiapan kamera lokal/remote tidak diperiksa. Latar `off` langsung dianggap siap walaupun izin kamera masih menunggu atau ditolak.
- Bukti: inspeksi jalur kode; belum diuji dengan dua perangkat dan jaringan nyata.
- Perbaikan: pisahkan state `ready`, `countingDown`, `capturing`, dan `exchanging`; satu attempt aktif sampai pasangan utuh diterima atau dibatalkan. Kesiapan kamera berbeda dari status tersambung.

### 3. [P2] Render yang selesai terlambat mengambil alih navigasi

Lokasi: [RendererView.vue](../src/features/renderer/RendererView.vue), baris 69–80.

- Trigger: pengguna meninggalkan layar render sebelum promise selesai dan kembali ke konfigurasi atau memulai sesi lain.
- Completion selalu menulis `renderId`, status completed, dan menjalankan `router.replace`, tanpa memeriksa komponen atau session yang masih aktif.
- **Terbukti di browser:** setelah berpindah ke `/config?source=upload`, penyelesaian render mengalihkan kembali ke `/output?renderId=...` milik sesi sebelumnya.
- Perbaikan: penyimpanan hasil boleh selesai, tetapi perubahan UI/store/navigation wajib memeriksa token operasi dan sessionId yang masih dimiliki layar aktif.

### 4. [P2] Kembali dari review upload membuka editor kosong

Lokasi: [ReviewView.vue](../src/features/review/ReviewView.vue) baris 394–395 dan [UploadView.vue](../src/features/upload/UploadView.vue) baris 410–426.

- Tombol kembali mengarah ke `/upload`. Editor upload menyimpan file/crop dalam ref lokal dan menghapusnya saat unmount, sedangkan mount hanya mengembalikan konfigurasi.
- Pengguna harus memilih dan mengatur framing semua foto lagi meskipun shot sesi sudah ada di database.
- **Terbukti di browser:** tiga foto tampil di review; sesudah kembali, database masih menyimpan tiga shot tetapi UI hanya menampilkan pemilih file kosong.
- Perbaikan: simpan draft upload beserta framing pada state sesi yang bertahan antarhalaman; hydrate ketika kembali. Tentukan eksplisit bagaimana draft dipulihkan setelah reload, bukan hanya route Back.

### 5. [P2] Kamera tetap aktif setelah meninggalkan halaman Duet

Lokasi: [BoothHubView.vue](../src/features/booth/BoothHubView.vue) baris 57–62 dan 76–82. Pola serupa ada pada `startCamera` dan `connectSession` di [BoothRoomView.vue](../src/features/booth/BoothRoomView.vue), baris 813–823 dan 1393–1404.

- Trigger: permintaan kamera belum selesai ketika pengguna menekan Buat Booth atau kembali. Cleanup berjalan ketika stream masih null.
- Stream yang selesai sesudah unmount tetap diterima dan tidak memiliki cleanup berikutnya. Pada room, koneksi async juga dapat memasang resource setelah view ditutup.
- **Terbukti di browser untuk hub:** media buatan yang diselesaikan setelah pindah ke `/config` tetap memiliki track `live`.
- Perbaikan: lifecycle token/generation untuk setiap request media/koneksi; hentikan stream atau dispose transport yang selesai setelah token invalid. Pola guard kamera Solo sudah ada dan dapat dikonsolidasikan.

### 6. [P2] Kegagalan ganti kamera membuat shutter terkunci

Lokasi: [CameraView.vue](../src/features/camera/CameraView.vue), baris 707–712; kaitannya dengan `setupCamera` 323 dan guard shutter 865–872.

- Jika switch gagal, catch memanggil `setupCamera()`, yang menaikkan `setupGeneration`.
- Kondisi di finally kemudian gagal dan tidak pernah mengembalikan `isSwitchingCamera` ke false. Shutter serta pemilih kamera tetap diblokir walaupun kamera fallback berhasil dibuka.
- Bukti: inspeksi jalur kode; belum diuji dengan kegagalan kamera fisik.
- Perbaikan: pisahkan token operasi switch dari setup, dan pastikan busy state dibersihkan pada semua jalur fallback yang masih aktif.

### 7. [P2] Penyimpanan penuh menghalangi unduh PNG yang sudah berhasil dirender

Lokasi: [services/session/index.ts](../src/services/session/index.ts), baris 268–274 dan 293–326; [RendererView.vue](../src/features/renderer/RendererView.vue) baris 81–89.

- Rendering menghasilkan Blob, tetapi fungsi hanya mengembalikan ID setelah penyimpanan berhasil. Jika IndexedDB gagal, Blob tidak diberikan ke layar hasil.
- **Terbukti di browser dengan injeksi QuotaExceededError pada penyimpanan render:** pengguna kembali ke Review dengan pesan storage penuh, tanpa akses unduh hasil yang sudah dirender.
- Pesan error tetap terlihat; masalahnya bukan pesan yang hilang, melainkan render terikat pada keberhasilan penyimpanan.
- Perbaikan: pisahkan hasil render di memori dari persistence. Download tetap tersedia; status galeri menyatakan penyimpanan belum berhasil. Ini sesuai production spec bagian 10.2.

### 8. [P2] Perintah typecheck memberi hasil hijau tanpa memeriksa aplikasi

Lokasi: [package.json](../package.json), script typecheck baris 21, dan [tsconfig.json](../tsconfig.json), `files: []` serta project references.

- `vue-tsc --noEmit` memakai root config kosong dan tidak menjalankan pemeriksaan project references dalam build mode.
- **Terbukti:** `npm run typecheck` exit 0; `vue-tsc --noEmit --listFilesOnly` tidak mencantumkan file. `vue-tsc -b --noEmit`, yang juga dipakai langkah build, gagal dengan 6 error TS2345.
- Error aktual berada di pemakaian prop wajib `ariaLabel` pada VirtualBackgroundPicker dan BoothDecorationPicker. Jadi status typecheck saat ini memberi keyakinan yang keliru sebelum build.
- Perbaikan: samakan script dengan pemeriksaan project references dan selesaikan error prop; pastikan pemeriksaan di CI menjalankan command yang sama.

### 9. [P3] Progress menandai Hasil saat masih merender

Lokasi: [FlowProgress.vue](../src/components/common/FlowProgress.vue), baris 43–46.

`render` selalu dipetakan ke `output`, padahal daftar langkah noncompact masih mempunyai langkah Render. Renderer menggunakan mode noncompact. Pemetaan ini perlu mengikuti daftar tahap yang benar-benar ditampilkan. Komponen progress juga belum digunakan konsisten di Kamera, Review, Output, dan Duet.

## Bentuk pembagian kode yang disarankan

| Batas tanggung jawab | Pemilik yang disarankan | Tujuan |
|---|---|---|
| Mode, sumber, konfigurasi, fase, attempt aktif | Pengatur sesi bersama + state yang eksplisit | Satu tempat memvalidasi transisi dan mencegah operasi ganda |
| Kamera, izin, pemilih device, penghentian track | Controller media | Setiap request punya pemilik lifecycle dan jalur cleanup |
| Pengambilan lokal / kontribusi foto dari peserta Duet | Adapter input lokal dan Duet | Infrastruktur online tidak menjadi dependency Solo |
| Draft upload dan shot sesi | Store/repository sesi | Navigasi kembali dan reload memiliki perilaku yang terdefinisi |
| Render gambar/video | Render service yang sudah ada | Mengembalikan artefak tanpa mewajibkan database berhasil |
| Simpan ke galeri | Persistence service | Status penyimpanan terpisah dari status render |
| Download/save/share/print | Aksi output bersama | Perbaikan capability dan output berlaku pada Solo serta Duet |
| Tampilan config/capture/review/output | View dan komponen UI | Menampilkan state dan memanggil aksi tanpa mengorkestrasi seluruh proses |

Pisahkan `mode: solo | duet` dari `source: camera | upload`. Saat ini `CaptureSource = camera | upload | booth` mencampur kedua konsep. Pemisahan tersebut mendukung arah userflow baru, tetapi tidak otomatis mengaktifkan upload Duet atau sinkronisasi frame custom; keduanya tetap pekerjaan produk tersendiri.

State internal perlu lebih rinci daripada empat tahap yang dilihat pengguna. Contoh: `preparing → ready → countingDown → capturing → exchanging → reviewing → rendering → completed`, dengan transisi error/cancel yang jelas. UI tetap dapat menampilkan Atur sesi → Foto → Review → Hasil.

## Urutan perbaikan

1. Pulihkan pemeriksaan typecheck/lint agar menjadi pagar yang bisa dipercaya.
2. Tambahkan regresi untuk attempt retake, double-start, navigasi saat render, dan media yang selesai setelah unmount; perbaiki temuan terkait terlebih dahulu.
3. Tetapkan model sesi, sumber/mode, state transisi, dan kepemilikan operasi async. Pertahankan pipeline render dan repository yang sudah berguna.
4. Pindahkan lifecycle media dan orkestrasi keluar dari view secara bertahap; satukan aksi output Solo/Duet.
5. Pulihkan draft upload dan fallback output saat storage gagal.
6. Terapkan penyederhanaan beranda/progress sesuai userflow, kemudian perluas parity Duet dengan scope yang tercatat.

Memecah template Vue menjadi banyak file sebelum menetapkan batas state tidak menyelesaikan race yang ditemukan. Urutan di atas membuat refactor dapat diuji per perubahan tanpa mengganti seluruh aplikasi sekaligus.

## Verifikasi sebelum perbaikan

- Unit tests: **154 lulus dalam 34 file**. Ada warning fallback asset/Path2D pada lingkungan unit test; kelulusan ini tidak membuktikan seluruh visual browser benar.
- Lint: **gagal, 4 error dan 6 warning**.
- Script typecheck saat ini: exit 0 tetapi tidak memeriksa file aplikasi.
- Pemeriksaan `vue-tsc -b --noEmit`: **gagal, 6 error TS2345** terkait prop `ariaLabel`.
- Lima reproduksi terarah pada Chromium dengan profil sementara: editor upload setelah Back, navigasi render terlambat, quota render, pesan retake tertunda, serta stream kamera terlambat. Semua mengonfirmasi perilaku yang disebutkan di temuan terkait.
- Reproduksi retake memakai dua peer in-process dan foto sintetis. Reproduksi kamera memakai stream buatan. Hasil ini membuktikan bug state/lifecycle, bukan kelulusan jaringan nyata atau perangkat kamera fisik.
- E2E penuh dan pengujian lintas perangkat/browser belum dijalankan pada audit awal. Perubahan pengguna yang sudah ada dipertahankan selama perbaikan.

## Verifikasi setelah perbaikan

- `npm run typecheck`: lulus; pemeriksaan project references yang sama juga lulus di build akhir.
- `npm run lint`: lulus tanpa error/warning.
- `npm run test`: **171 lulus dalam 36 file**. Termasuk attempt retake/cancel, kesiapan capture, output quota, pembatalan render, dan sumber Duet di memori.
- `npm run build`: lulus, termasuk Vue/TypeScript, Vite, service worker, dan halaman SEO.
- `npm run pwa:audit`: lulus.
- **19 skenario Chromium telah lulus**: smoke aplikasi (7), upload/render (2), draft upload dan fallback kamera (3), lifecycle media (2), readiness/locking Duet (2), serta pembatalan render/quota/cache galeri (3).
- **7 skenario WebKit dengan profil Mobile Safari telah lulus**: upload/render (2), draft upload (2), dan regresi render (3). Satu test fake-camera khusus Chromium sengaja dilewati di WebKit.
- Run gabungan awal menemukan assertion warna exact yang terlalu ketat terhadap sumber JPEG. Assertion diperbaiki dengan toleransi maksimal 3 per kanal; ketiga tes render diulang dan lulus di Chromium serta WebKit. Test tetap memeriksa warna foto pengganti, bukan foto dari job lama.
- WebKit dipasang di direktori sementara khusus QA setelah runner awal belum tersedia; kegagalan launch awal bukan kegagalan aplikasi.
- Kamera browser menggunakan stream/fake device dan protokol Duet diuji dengan peer terkendali. Kamera fisik, jaringan lintas perangkat nyata, dan keseluruhan suite E2E belum diklaim lulus. Peringatan fallback Path2D/asset pada unit serta data Browserslist lama pada build tidak memblokir hasil check di atas.
