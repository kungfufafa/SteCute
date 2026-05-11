# PRD - Stecute

Dokumen: Product Requirements Document  
Versi: 1.2  
Tanggal: 2026-03-20  
Status: Finalized baseline siap implementasi production-ready  
Pemilik dokumen: Product + Founder

---

## 1. Ringkasan produk

Produk yang akan dibangun adalah aplikasi web photo booth offline-first tanpa login yang memungkinkan pengguna membuka aplikasi, memberi izin kamera atau mengunggah foto lokal, memilih jumlah foto, mengambil atau menyusun beberapa foto, melakukan review dan retake, lalu langsung menyimpan hasil sebagai photo strip tanpa membuat akun.

Produk ini ditujukan untuk dua konteks utama:

1. Pengguna umum yang ingin selfie atau foto bareng dengan pengalaman mirip photo booth modern.
2. Pengguna event atau operator booth yang butuh aplikasi sederhana, cepat, tetap dapat dipakai ketika koneksi internet buruk atau putus, dan mampu melayani sesi berulang dengan cepat.

Prinsip utama produk:

- Tanpa login.
- Offline-first setelah app shell dan aset inti tercache.
- Semua proses inti berjalan lokal di device pengguna.
- Foto dan hasil akhir disimpan lokal secara default.
- Cepat dipakai dalam hitungan detik.
- Tetap kompetitif dalam variasi layout, alur capture, dan output tanpa membebani pengguna dengan terlalu banyak pilihan awal.
- UI sederhana untuk consumer, namun cukup kuat untuk event use.

Dokumen pendamping yang menjadi referensi final untuk implementasi:

- `stecute-production-spec.md`
- `stecute-asset-spec.md`
- `stecute-release-checklist.md`

---

## 2. Latar belakang dan konteks

Berdasarkan pola dari aplikasi referensi, kebutuhan inti pasar untuk produk photo booth digital adalah:

- Pengambilan beberapa foto berurutan dengan timer singkat.
- Format output utama menyediakan layout standar `2 foto`, `3 foto`, `4 foto`, dan `6 foto`, lalu dapat diperluas oleh blanko/template yang membawa layout sendiri seperti `5 foto` atau jumlah slot lain.
- Template default yang clean dan konsisten tanpa memperlambat alur inti.
- Output yang langsung bisa diunduh, disimpan, dibagikan, atau dicetak ringan.
- Pengalaman yang ringan, instan, estetik, dan cocok untuk event maupun penggunaan personal.

Masalah yang ingin diselesaikan:

- Banyak pengguna hanya ingin langsung foto tanpa harus daftar atau login.
- Koneksi internet di venue event tidak selalu stabil.
- Aplikasi berbasis web sering terasa lambat atau rumit jika terlalu bergantung pada backend.
- Sebagian pengguna peduli pada privasi dan tidak ingin foto otomatis diunggah ke server.
- Banyak aplikasi photo booth web terasa menarik di landing, tetapi kurang kuat di alur event berulang dan offline usability.

Kesimpulan produk:

Aplikasi harus memprioritaskan local-first execution. Semua fungsi utama capture, upload lokal, review, retake, compositing, export, save, dan gallery lokal harus dapat berjalan di perangkat pengguna setelah aplikasi dimuat dan tercache.

---

## 3. Visi produk

Menjadi aplikasi photo booth web offline-first tanpa login yang paling cepat, nyaman, privat, dan fleksibel untuk membuat photo strip digital di browser.

---

## 4. Tujuan bisnis dan tujuan produk

### 4.1 Tujuan bisnis

- Menghadirkan MVP yang cukup kuat untuk validasi pasar consumer dan event.
- Menekan biaya infrastruktur dengan memproses mayoritas alur di sisi client.
- Membedakan produk lewat privacy by default, offline-first, dan alur photo booth yang cepat serta mudah dipahami.
- Membuka peluang monetisasi tahap lanjut lewat template premium, branding event, kiosk mode, atau paket SaaS event.

### 4.2 Tujuan produk

- Pengguna bisa memulai sesi foto dalam kurang dari 10 detik setelah aplikasi siap.
- Pengguna bisa menyelesaikan alur foto sampai hasil tersimpan dalam kurang dari 2 menit pada flow standar.
- Aplikasi tetap usable ketika offline setelah initial load dan asset cache selesai.
- Pengguna tidak wajib membuat akun untuk memakai fitur inti.
- Aplikasi terasa cukup menarik dibanding photo booth web populer walau tanpa backend wajib.

### 4.3 Non-goals untuk MVP

- Marketplace creator.
- Login, profil, atau histori lintas device.
- AI retouch berat.
- Kolaborasi multi-user real-time.
- Cloud sync wajib.
- Pembayaran dan template berbayar.
- Native print driver.
- QR delivery yang mengharuskan backend.
- Kustomisasi manual pasca-capture seperti frame color, sticker, date/time, dan logo text. Fitur ini ditunda sampai alur inti capture-review-render terasa solid.

---

## 5. Persona pengguna

### Persona A - Casual user

- Ingin foto sendiri atau bersama teman.
- Mengutamakan hasil cepat, lucu, estetik.
- Tidak mau ribet daftar akun.
- Biasanya memakai laptop atau ponsel.

Kebutuhan utama:

- Kamera cepat aktif.
- Timer jelas.
- Layout menarik.
- Template hasil yang menarik tanpa setup panjang.
- Mudah retake.
- Mudah simpan hasil.

### Persona B - Event operator

- Menjalankan booth di wedding, gathering, sekolah, kampus, brand activation.
- Membutuhkan aplikasi stabil, mudah dijelaskan, dan tetap jalan walau internet buruk.
- Ingin template acara, preset branding, dan mode sesi cepat.

Kebutuhan utama:

- Bisa dipasang sekali lalu dipakai terus.
- Flow tiap tamu cepat dan mudah direset.
- Error handling jelas.
- Hasil bisa disimpan lokal dan dicetak ringan bila browser mendukung.
- Booth dapat kembali siap untuk tamu berikutnya tanpa kebingungan.

---

## 6. Problem statement

"Sebagai pengguna, saya ingin membuka aplikasi photo booth dan langsung membuat hasil foto yang estetik tanpa login, tanpa setup rumit, tetap bisa digunakan meski koneksi internet tidak stabil, dan tetap yakin bahwa foto saya tetap berada di device saya."

---

## 7. Proposition nilai

- Tanpa login dan tanpa friksi akun.
- Offline-first dan local-first, cocok untuk event dan koneksi buruk.
- Privacy by default: foto diproses lokal dan tidak wajib diunggah ke server.
- Format cetak utama memakai varian adaptif standar `2 foto`, `3 foto`, `4 foto`, dan `6 foto`, dengan dukungan template-defined layout untuk blanko yang jumlah slotnya berbeda.
- Template default `Classic` memberi hasil clean seperti photobooth, dengan pilihan template bundled sebelum capture tanpa langkah kustomisasi tambahan setelah review.
- Output siap pakai: download, save to device, share sheet, dan print ringan bila browser mendukung.
- Dapat diinstal sebagai PWA untuk pengalaman yang terasa seperti aplikasi.

---

## 8. Ruang lingkup MVP

### 8.1 Fitur utama MVP

1. Landing dan app shell ringan.
2. Permintaan izin kamera saat dibutuhkan.
3. Opsi sumber foto: kamera atau upload foto lokal.
4. Pemilihan kamera depan atau belakang jika tersedia.
5. Pilihan hasil cetak dasar: `2 foto`, `3 foto`, `4 foto`, `6 foto`, plus layout dari blanko/template lokal dengan tinggi canvas mengikuti artboard.
6. Countdown default 3 detik untuk flow kamera.
7. Preset filter kamera lokal sebelum capture, dengan preview live dan hasil render final memakai efek yang sama.
8. Capture berurutan sesuai jumlah slot layout.
9. Review hasil per sesi.
10. Retake seluruh sesi.
11. Retake per-shot sebelum render final.
12. Template default `Classic` dengan visual photobooth clean, pilihan template bundled yang kompatibel dengan layout aktif, dan upload blanko strip lokal.
13. Render hasil final photo strip.
14. Download hasil PNG.
15. Save to device melalui flow browser yang tersedia.
16. Native share sheet jika browser mendukung.
17. Print ringan jika browser mendukung.
18. Penyimpanan lokal gallery terbatas untuk 10 final render terakhir.
19. Dukungan offline setelah initial install atau cache.
20. Reset session cepat untuk pengguna berikutnya.
21. Shortcut keyboard dasar untuk desktop.
22. Basic responsive UI untuk desktop, tablet, mobile.

### 8.2 Fitur nice-to-have bila sempat dalam MVP+

- Kustomisasi manual pasca-capture: frame color, sticker, date/time, dan logo text.
- Filter per-shot, filter custom, atau preview filter berbasis asset raster.
- Upload custom background lokal di luar blanko strip.
- Sound on or off.
- Auto-reset sesudah export untuk event mode.
- Idle screen atau attract screen.
- Preset event branding.
- GIF export lokal jika performa device memadai.

### 8.3 Fitur fase berikutnya

- Mode operator atau kiosk yang lebih lengkap.
- Branding event lanjutan.
- Upload opsional ke cloud setelah online kembali.
- Share link.
- QR handoff.
- Analytics event.
- Template pack premium.
- Creator tools.
- Wrapper desktop dengan Tauri untuk venue yang butuh integrasi OS lebih dalam.

---

## 9. User journey utama

### Journey A - Pengguna umum

1. Pengguna membuka aplikasi.
2. Jika pertama kali, aplikasi menjelaskan bahwa fitur inti berjalan lokal dan offline penuh tersedia setelah cache selesai.
3. Pengguna memilih kamera atau upload foto lokal.
4. Pengguna memilih jumlah foto.
5. Pengguna mengambil foto sesuai jumlah slot layout.
6. Pengguna melihat preview hasil dan dapat retake per-shot atau seluruh sesi.
7. Pengguna membuat hasil final.
8. Pengguna menekan download, save, share, print, atau mulai sesi baru.
9. Jika download atau save, file tersimpan lokal.

### Journey B - Event booth

1. Operator membuka aplikasi dan memastikan app shell sudah tercache.
2. Operator memakai default layout/template yang sudah tersedia lokal.
3. Tamu datang dan menekan mulai.
4. Sesi foto berjalan cepat tanpa login.
5. Hasil final langsung tersedia untuk download, save, share, atau print bila didukung browser.
6. Operator menekan reset manual setelah sesi selesai.
7. Booth kembali ke state siap untuk tamu berikutnya.

---

## 10. Functional requirements

### FR-01 Landing and entry

- Aplikasi menampilkan CTA yang jelas: Mulai, Pilih Layout, Cek Kamera, dan Upload Foto.
- Saat offline, aplikasi tetap bisa dibuka jika sudah pernah dimuat sebelumnya.
- Landing menjelaskan trust message bahwa foto diproses lokal dan tidak wajib diunggah.

Acceptance criteria:

- Pengguna bisa masuk ke layar sesi maksimal dalam 2 langkah.
- Status online atau offline terlihat secara halus, tidak mengganggu.
- Pesan trust dan offline readiness terlihat jelas tetapi tidak mendominasi layar.

### FR-02 Camera permission and setup

- Aplikasi meminta izin kamera hanya saat dibutuhkan.
- Pengguna dapat melihat preview kamera sebelum mulai.
- Jika perangkat punya lebih dari satu kamera, pengguna dapat mengganti kamera.

Acceptance criteria:

- Jika izin ditolak, aplikasi memberi panduan recovery yang jelas.
- Preview tampil dengan rasio yang sesuai layout aktif.

### FR-03 Session configuration

- Pengguna memilih blanko/paket strip sebelum sesi dimulai; jumlah foto mengikuti layout dari paket tersebut.
- Sumber foto berasal dari entry point awal: `Mulai Foto` atau `Upload Lokal`.
- Template dapat dipilih sebagai bagian dari paket blanko sebelum sesi dimulai; `Classic` tetap default agar flow tetap singkat.
- Pengguna dapat mengunggah blanko strip lokal sebelum sesi dimulai.
- Blanko upload tersimpan sebagai template lokal di perangkat/browser yang sama agar bisa dipakai ulang pada sesi berikutnya.

Acceptance criteria:

- Minimal tersedia hasil cetak `2 foto`, `3 foto`, `4 foto`, dan `6 foto` dengan ukuran output yang fit terhadap jumlah foto.
- Template public atau blanko custom boleh menambahkan layout non-standar bila membawa slot coordinate sendiri.
- Default aktif memakai template `Classic`.
- Template yang memakai blanko raster khusus tampil sebagai paket blanko sendiri dengan jumlah slot yang dibawa template tersebut.
- Blanko custom harus berupa PNG atau WebP lokal dengan area foto transparan; jumlah slot dideteksi dari blanko.
- Template lokal hasil upload tidak dibagikan ke perangkat lain tanpa mekanisme backend/sinkronisasi terpisah.

### FR-04 Countdown and capture

- Aplikasi mengambil foto berurutan sesuai jumlah slot layout aktif.
- Countdown kamera memakai default 3 detik.
- Sistem memberi feedback visual yang jelas pada setiap pengambilan.

Acceptance criteria:

- Pengguna tahu foto ke berapa yang sedang diambil.
- Jeda antar shot konsisten.
- Hasil cetak standar dan template-defined menghasilkan jumlah shot yang benar dan tinggi output sesuai layout aktif.

### FR-05 Upload local images

- Pengguna dapat memilih beberapa file gambar lokal sebagai alternatif kamera.
- Gambar lokal mengikuti jumlah slot layout aktif.
- Setelah memilih file valid, pengguna dapat mengatur framing tiap foto sebelum masuk review agar rasio file yang berbeda tetap fit dengan slot layout.

Acceptance criteria:

- File lokal diproses tanpa backend.
- Jika jumlah file kurang dari jumlah slot, sistem memberi panduan yang jelas.
- Format yang diterima dibatasi ke JPG, PNG, atau WebP.
- Ukuran file maksimum 10 MB per file.
- Framing upload berjalan lokal di browser dengan pola clip crop sederhana: foto otomatis masuk ke frame, pengguna cukup seret foto jika perlu, aksi foto aktif hanya berisi kembalikan posisi dan ganti foto, sedangkan aksi untuk semua foto dipisah di area daftar foto.

### FR-06 Review, render, and retake

- Setelah sesi selesai, pengguna bisa melihat semua shot dan preview final.
- Pengguna dapat retake seluruh sesi.
- Pengguna dapat retake per-shot sebelum render final.
- Pengguna dapat melanjutkan langsung ke render final tanpa langkah kustomisasi tambahan.

Acceptance criteria:

- Template default diterapkan pada hasil final tanpa koneksi internet.
- Retake menghapus hasil sementara session sebelumnya bila pengguna konfirmasi.
- Retake per-shot tidak menghapus shot lain yang masih valid.

### FR-07 Photo strip rendering

- Sistem menggabungkan foto sesuai layout aktif dan template aktif.
- Sistem menghasilkan output final dengan resolusi siap simpan dan siap cetak ringan.

Acceptance criteria:

- Render final selesai tanpa freeze yang terasa pada device target.
- Hasil strip konsisten dengan preview.

### FR-08 Export and local save

- Pengguna dapat mengunduh hasil sebagai PNG.
- Pengguna dapat menyimpan hasil ke device melalui flow browser yang tersedia.
- Pengguna dapat menggunakan native share sheet bila browser mendukung.
- Pengguna dapat menggunakan print ringan bila browser mendukung sebagai capability bonus.
- Sistem menyimpan maksimal 10 final render terakhir secara lokal.

Acceptance criteria:

- Download berhasil tanpa backend.
- Hasil terakhir dapat dipreview lagi ketika aplikasi dibuka ulang di device yang sama.
- Fitur yang tidak didukung browser tampil sebagai unavailable, bukan error.
- Nama file hasil mengikuti pola konsisten berbasis tanggal, layout, dan template.

### FR-09 Offline mode

- Setelah app shell dan aset inti tersimpan, fungsi utama harus tetap berjalan tanpa internet.
- Template inti dan visual default template tersedia offline.

Acceptance criteria:

- Capture, upload lokal, review, render, dan download tetap berjalan saat device offline.
- Fitur yang butuh internet diberi label opsional atau future.

### FR-10 Session reset and event flow

- Harus ada tombol reset yang mudah ditemukan.
- Reset membersihkan state session aktif tanpa menghapus seluruh aplikasi.
- Event flow harus mendukung sesi berulang dengan cepat.

Acceptance criteria:

- Dalam mode event, reset session selesai kurang dari 2 detik.
- Shortcut keyboard dasar tersedia untuk desktop.

---

## 11. Non-functional requirements

### NFR-01 Performance

- First meaningful UI pada koneksi normal: target kurang dari 3 detik.
- Warm launch setelah cache: target kurang dari 2 detik.
- Render strip final: target kurang dari 2 detik pada device target menengah.
- Render strip final pada mobile target menengah: target kurang dari 4 detik.
- Initial JS bundle shell ideal kurang dari 300 KB gzip di luar asset template.

### NFR-02 Reliability

- Jika internet putus setelah initial load, fungsi inti tetap berjalan.
- Jika render gagal, pengguna dapat mencoba ulang tanpa refresh total.

### NFR-03 Privacy

- Tidak ada kewajiban upload foto ke server.
- Secara default foto dan hasil disimpan lokal.
- Tidak ada login pada MVP.
- Pesan privacy by default harus menjadi bagian eksplisit dari UX.

### NFR-04 Accessibility

- Tombol utama besar dan jelas.
- Countdown mudah dibaca.
- Kontras UI cukup.
- Dukungan keyboard dasar untuk desktop.

### NFR-05 Security

- Aplikasi hanya berjalan di secure context.
- Permission kamera dikelola secara eksplisit.
- Tidak ada eksekusi template dinamis yang tidak tervalidasi.
- Font produksi harus self-hosted.
- Input teks kustom belum ada di v1 process-first.

### NFR-06 Maintainability

- Komponen UI, capture engine, render engine, template engine, dan persistence dipisahkan jelas.
- Layout dan template dapat ditambah tanpa mengubah core flow.

---

## 12. UX principles

- Satu layar, satu tugas utama.
- Hindari pop-up yang tidak perlu.
- Prioritaskan feedback instan: timer, flash, status render, status unduh.
- Layout nyaman disentuh di tablet dan mobile.
- Tunjukkan privacy dan offline state secara jelas namun halus.
- UI event-friendly: operator bisa menjalankan sesi berulang dengan cepat.
- Pilihan template harus memperkaya hasil tanpa menambah langkah setelah review.

---

## 13. Success metrics

### Product metrics

- Session start rate.
- Session completion rate.
- Download completion rate.
- Save completion rate.
- Retake rate.
- Offline completion rate.

### Experience metrics

- Median waktu dari app open ke first capture.
- Median waktu dari start session ke output final.
- Error rate pada permission kamera.
- Crash or hard-failure rate pada render.

### Business validation metrics

- Jumlah device yang menginstal PWA.
- Jumlah session per event day.
- Jumlah layout atau template paling sering dipakai.
- Rasio penggunaan kamera vs upload lokal.

---

## 14. Prioritas rilis

### Phase 0 - Prototype internal

- UI flow dasar.
- Kamera aktif.
- Capture dinamis sesuai layout.
- Render strip sederhana.
- Download lokal.

### Phase 1 - MVP publik

- PWA offline-first.
- Format cetak adaptif dengan varian standar `2 foto`, `3 foto`, `4 foto`, `6 foto`, plus template-defined layout lokal.
- Template default Classic, pilihan template bundled yang kompatibel dengan layout aktif, dan upload blanko strip lokal.
- Upload foto lokal.
- Gallery 10 hasil terakhir.
- Error state permission kamera.
- Mobile and tablet optimization.
- Retake per-shot sebelum render final.
- Download, save, share, print bila browser mendukung.

### Phase 2 - Event mode

- Reset session cepat.
- Shortcut keyboard lebih lengkap.
- Branding event.
- Idle screen dan auto-reset.
- Gallery terbatas.
- Upload opsional saat online.

### Phase 3 - Revenue features

- Template premium.
- Creator tools.
- Share link.
- QR delivery.
- Kiosk extensions.

---

## 15. Risiko dan mitigasi

### Risiko 1 - Browser compatibility berbeda

Mitigasi:

- Target browser modern lebih dahulu.
- Sediakan fallback UI dan browser support matrix.

### Risiko 2 - Kamera ditolak atau gagal aktif

Mitigasi:

- Tampilkan recovery steps yang jelas.
- Sediakan mode preview test sebelum sesi.
- Sediakan upload lokal sebagai fallback.

### Risiko 3 - Offline-first disalahpahami sebagai full offline dari kunjungan pertama

Mitigasi:

- Jelaskan bahwa aplikasi perlu dibuka minimal sekali saat online agar aset inti tersimpan.

### Risiko 4 - Render berat di device lemah

Mitigasi:

- Gunakan worker untuk compositing.
- Sediakan preset resolusi sesuai device.
- Batasi ukuran dan kompleksitas template aktif bila perlu.

### Risiko 5 - Penyimpanan lokal penuh

Mitigasi:

- Batasi gallery lokal default.
- Beri opsi hapus hasil lama.
- Simpan asset template secara bundled, bukan duplikasi per sesi.

---

## 16. Asumsi produk

- Fokus utama MVP adalah web app PWA, bukan native mobile app.
- Tidak ada backend wajib untuk fitur inti.
- Pengguna menerima model anonymous local session.
- Layout dan template inti dibundel ke aplikasi agar tersedia offline.

---

## 17. Dependensi utama lintas tim

### Product

- Menentukan prioritas consumer vs event.
- Menentukan layout inti, template inti, dan final scope v1.

### Design

- Membuat UI state lengkap: loading, permission denied, offline, rendering, success, error.
- Membuat minimal 4 layout dasar.
- Membuat template default Classic yang clean dan siap dipakai.
- Menyediakan asset spec final dan font self-hosted.

### Engineering

- Capture engine.
- Upload lokal flow.
- Render and template engine.
- Offline caching.
- Local persistence.

### QA

- Uji browser utama.
- Uji offline mode.
- Uji kamera depan atau belakang.
- Uji output capability: download, share, print, save flow.

---

## 18. Keputusan final produksi

- Preset event dasar tidak masuk v1. Masuk fase berikutnya.
- GIF export lokal tidak masuk v1.
- Print ringan diperlakukan sebagai capability bonus, bukan blocker rilis.
- Kustomisasi manual pasca-capture selain preset filter kamera ditunda dari v1 agar tim fokus pada alur capture-review-render-output yang paling nyaman.
- Gallery lokal menyimpan final render, bukan raw shots jangka panjang.

---

## 19. Definisi selesai untuk MVP

MVP dianggap selesai jika:

- Pengguna bisa membuka aplikasi tanpa login.
- Pengguna bisa memilih sumber foto dan jumlah foto.
- Pengguna bisa mengambil atau mengunggah foto sesuai jumlah slot layout.
- Pengguna bisa melihat hasil strip final tanpa langkah kustomisasi tambahan.
- Pengguna bisa melihat hasil strip final.
- Pengguna bisa mengunduh atau menyimpan hasil tanpa backend.
- Aplikasi tetap dapat digunakan offline setelah initial load dan cache selesai.
- Error state utama sudah tertangani: izin kamera ditolak, kamera tidak ditemukan, render gagal, storage penuh, browser capability terbatas.
- Browser target utama lulus QA dasar.
- Asset inti final sudah tersedia lokal dan tidak bergantung pada CDN.
