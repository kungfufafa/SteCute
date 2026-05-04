export type PublicPageId = 'privacy' | 'terms' | 'faq' | 'about'

export type PublicNavItem = {
  id: PublicPageId
  label: string
  path: string
}

type StandardSection = {
  id: string
  type?: 'section'
  title: string
  body: string[]
  bullets?: string[]
}

type FaqSection = {
  id: string
  type: 'faq'
  title: string
  intro?: string
  items: {
    question: string
    answer: string[]
  }[]
}

export type PublicPage = {
  id: PublicPageId
  eyebrow: string
  title: string
  summary: string
  updatedLabel: string
  sections: (StandardSection | FaqSection)[]
}

export const supportEmail = 'developer@rizqis.com'

export const publicNavItems: PublicNavItem[] = [
  { id: 'privacy', label: 'Kebijakan Privasi', path: '/privacy' },
  { id: 'terms', label: 'Syarat & Ketentuan', path: '/terms' },
  { id: 'faq', label: 'FAQ', path: '/faq' },
  { id: 'about', label: 'Tentang', path: '/about' },
]

export const publicPages = {
  privacy: {
    id: 'privacy',
    eyebrow: 'Transparansi data',
    title: 'Kebijakan Privasi',
    summary:
      'Stecute memproses foto di browser. Tidak ada login atau upload otomatis untuk fitur inti; hasil tersimpan lokal di perangkat yang sama.',
    updatedLabel: 'Terakhir diperbarui: 4 Mei 2026',
    sections: [
      {
        id: 'data-yang-diproses',
        title: 'Data yang diproses',
        body: [
          'Stecute memakai foto dari kamera atau file lokal yang kamu pilih untuk preview, review, retake, render final, download, save, share, atau print.',
          'Preferensi seperti layout, template, konfigurasi sesi, dan hasil render terakhir dapat disimpan lokal agar aplikasi tetap cepat di perangkat yang sama.',
        ],
        bullets: [
          'Sumber foto: kamera browser atau file lokal.',
          'Format upload: JPG, PNG, atau WebP.',
          'Batas upload: 10 MB per file.',
          'Output utama: PNG.',
        ],
      },
      {
        id: 'penyimpanan-lokal',
        title: 'Penyimpanan lokal',
        body: [
          'Data inti disimpan di browser pada perangkat yang sama, terutama melalui IndexedDB dan cache aplikasi.',
          'Gallery menyimpan maksimal 10 hasil render final. Raw shots hanya dipertahankan selama sesi aktif, review, retake, atau render, lalu dibersihkan saat reset atau retention cleanup.',
        ],
      },
      {
        id: 'yang-tidak-dilakukan',
        title: 'Yang tidak dilakukan Stecute',
        body: [
          'Fitur inti tidak mewajibkan akun, cloud sync, share link, QR handoff server, atau upload foto otomatis ke backend.',
          'Jika analytics, cloud, atau integrasi pihak ketiga ditambahkan nanti, kebijakan privasi harus diperbarui sebelum fitur dipakai.',
        ],
        bullets: [
          'Tidak ada upload otomatis untuk foto inti.',
          'Tidak ada login wajib.',
          'Tidak ada iklan atau pixel tracking bawaan pada rilis awal.',
          'Tidak menjual foto atau data gambar pengguna.',
        ],
      },
      {
        id: 'aksi-output',
        title: 'Download, save, share, dan print',
        body: [
          'Saat kamu memilih download, save, share, atau print, browser menjalankan aksi sesuai kemampuan perangkat.',
          'Share sheet, save to device, dan print berada di bawah kendali browser. Jika tidak tersedia, download PNG tetap menjadi jalur utama.',
        ],
      },
      {
        id: 'kontrol-pengguna',
        title: 'Kontrol pengguna',
        body: [
          'Kamu dapat menghapus hasil dari gallery lokal, menghapus semua hasil, mereset sesi aktif, atau membersihkan data situs dari browser.',
          'Membersihkan data browser dapat menghapus gallery, template lokal, cache aplikasi, dan preferensi perangkat.',
          `Untuk pertanyaan privasi, hubungi ${supportEmail}.`,
        ],
      },
      {
        id: 'anak-dan-event',
        title: 'Foto anak dan penggunaan event',
        body: [
          'Stecute dapat dipakai di acara keluarga, sekolah, kampus, atau event kecil. Jika foto melibatkan anak atau tamu event, penyelenggara bertanggung jawab memastikan persetujuan pengambilan dan penggunaan foto.',
          'Stecute tidak otomatis memverifikasi usia, identitas, atau persetujuan subjek foto.',
        ],
      },
    ],
  },
  terms: {
    id: 'terms',
    eyebrow: 'Aturan penggunaan',
    title: 'Syarat dan Ketentuan',
    summary:
      'Aturan dasar memakai Stecute sebagai photo booth web lokal tanpa login untuk fitur inti.',
    updatedLabel: 'Terakhir diperbarui: 4 Mei 2026',
    sections: [
      {
        id: 'penggunaan-layanan',
        title: 'Penggunaan layanan',
        body: [
          'Stecute membantu membuat photo strip digital dari kamera atau upload lokal. Kamu boleh memakainya untuk personal, acara kecil, atau booth selama mematuhi hukum dan hak pihak lain.',
          'Kamu tidak boleh menggunakan Stecute untuk membuat, menyimpan, membagikan, atau mencetak konten yang melanggar hukum, melanggar privasi, melecehkan, mengeksploitasi, atau merugikan pihak lain.',
        ],
      },
      {
        id: 'konten-pengguna',
        title: 'Konten pengguna',
        body: [
          'Foto, file upload, dan hasil render adalah konten pengguna. Stecute tidak mengklaim kepemilikan atas foto yang kamu buat atau unggah.',
          'Kamu bertanggung jawab memastikan hak, izin, atau persetujuan yang diperlukan sebelum mengambil, mengunggah, menyimpan, membagikan, atau mencetak foto.',
        ],
      },
      {
        id: 'batasan-browser',
        title: 'Batasan browser dan perangkat',
        body: [
          'Stecute bergantung pada browser modern. Kamera membutuhkan secure context dan izin browser.',
          'Save to device, native share, dan print dapat berbeda antar browser. Jika tidak tersedia, Stecute dapat menyembunyikan aksi tersebut atau memberi fallback download lokal.',
        ],
      },
      {
        id: 'offline-dan-storage',
        title: 'Offline dan storage lokal',
        body: [
          'Stecute dirancang offline-first. Kunjungan pertama tetap membutuhkan koneksi internet agar app shell dan aset inti dapat tersimpan.',
          'Hasil lokal dapat hilang jika data situs dihapus, browser membersihkan storage, perangkat kehabisan ruang, atau browser membatasi penyimpanan.',
        ],
      },
      {
        id: 'perubahan-layanan',
        title: 'Perubahan layanan',
        body: [
          'Stecute dapat memperbarui fitur, template, layout, atau halaman kebijakan. Perubahan yang memengaruhi privasi, flow data, atau kewajiban pengguna harus dijelaskan sebelum rilis publik.',
          `Untuk pertanyaan penggunaan atau pelaporan masalah, hubungi ${supportEmail}.`,
        ],
      },
      {
        id: 'batas-tanggung-jawab',
        title: 'Batas tanggung jawab',
        body: [
          'Stecute membantu membuat photo strip di browser, tetapi tidak menjamin setiap kamera, browser, printer, sistem share, atau storage perangkat bekerja identik.',
          'Sebelum event penting, operator disarankan melakukan uji perangkat, browser, kamera, offline cache, download, dan print sesuai kebutuhan acara.',
        ],
      },
    ],
  },
  faq: {
    id: 'faq',
    eyebrow: 'Pertanyaan umum',
    title: 'FAQ',
    summary:
      'Jawaban singkat sebelum memakai Stecute di perangkat pribadi atau event.',
    updatedLabel: 'Terakhir diperbarui: 4 Mei 2026',
    sections: [
      {
        id: 'pertanyaan-utama',
        type: 'faq',
        title: 'Pertanyaan utama',
        intro: 'Foto diproses lokal, offline tersedia setelah cache, dan output utama adalah PNG.',
        items: [
          {
            question: 'Apakah foto saya diupload ke server?',
            answer: [
              'Tidak untuk fitur inti. Foto dari kamera atau upload lokal diproses di browser untuk preview, review, render, dan output lokal.',
              'Jika nanti ada cloud atau share link, fitur itu harus opsional dan dijelaskan sebelum dipakai.',
            ],
          },
          {
            question: 'Apakah perlu login?',
            answer: [
              'Tidak. Stecute tidak membutuhkan akun untuk membuat photo strip, menyimpan hasil lokal, atau memakai gallery lokal.',
            ],
          },
          {
            question: 'Bisa dipakai offline?',
            answer: [
              'Bisa setelah aplikasi pernah dibuka saat online dan app shell serta aset inti berhasil tersimpan. Kunjungan pertama tetap membutuhkan koneksi internet.',
            ],
          },
          {
            question: 'Berapa lama hasil foto disimpan?',
            answer: [
              'Gallery lokal menyimpan maksimal 10 hasil render terakhir di browser perangkat yang sama. Hasil dapat hilang jika data situs dihapus.',
            ],
          },
          {
            question: 'Bagaimana cara menghapus foto?',
            answer: [
              'Buka Galeri, hapus hasil satu per satu, atau gunakan Hapus Semua. Kamu juga bisa membersihkan data situs dari pengaturan browser.',
            ],
          },
          {
            question: 'Format upload apa yang didukung?',
            answer: [
              'Upload foto lokal menerima JPG, PNG, dan WebP dengan batas 10 MB per file. Jumlah file harus sesuai jumlah slot layout yang dipilih.',
            ],
          },
          {
            question: 'Kenapa kamera tidak muncul?',
            answer: [
              'Biasanya karena izin kamera ditolak, browser tidak berjalan di secure context, kamera sedang dipakai aplikasi lain, atau MediaDevices API tidak didukung.',
              'Gunakan Upload Lokal sebagai fallback jika kamera tidak bisa dipakai.',
            ],
          },
          {
            question: 'Apakah bisa share atau print?',
            answer: [
              'Bisa jika browser dan perangkat mendukung Web Share API atau print flow. Jika tidak tersedia, download PNG tetap menjadi output utama.',
            ],
          },
          {
            question: 'Apakah cocok untuk event?',
            answer: [
              'Ya untuk personal dan event kecil sampai menengah. Operator tetap perlu menguji perangkat, koneksi awal, cache offline, kamera, download, dan printer sebelum acara.',
            ],
          },
          {
            question: 'Apakah aman untuk foto anak?',
            answer: [
              'Stecute memproses foto secara lokal pada fitur inti. Persetujuan pengambilan dan penggunaan foto anak tetap menjadi tanggung jawab pengguna atau penyelenggara event.',
            ],
          },
        ],
      },
    ],
  },
  about: {
    id: 'about',
    eyebrow: 'Tentang produk',
    title: 'Tentang Stecute',
    summary:
      'Stecute adalah photo booth web offline-first untuk membuat photo strip cepat, privat, dan mudah dipakai tanpa login.',
    updatedLabel: 'Terakhir diperbarui: 4 Mei 2026',
    sections: [
      {
        id: 'apa-itu-stecute',
        title: 'Apa itu Stecute',
        body: [
          'Stecute membantu pengguna membuka kamera atau memilih foto lokal, memilih layout, mengambil beberapa pose, review, retake, render, lalu menyimpan hasil sebagai photo strip.',
          'Produk ini dibuat agar alur foto terasa ringan, cepat, dan tetap bisa dipakai tanpa akun.',
        ],
      },
      {
        id: 'prinsip-produk',
        title: 'Prinsip produk',
        body: [
          'Stecute mengutamakan privacy by default, offline-first, dan local-first. Fitur inti tidak menjadikan server sebagai dependency wajib.',
          'Offline penuh tersedia setelah initial load dan cache berhasil.',
        ],
        bullets: [
          'Tanpa login untuk flow inti.',
          'Foto dan hasil final lokal secara default.',
          'Download PNG sebagai output utama.',
          'Share, save, dan print berbasis capability browser.',
        ],
      },
      {
        id: 'untuk-siapa',
        title: 'Untuk siapa',
        body: [
          'Stecute cocok untuk pengguna yang ingin membuat photo strip sendiri atau bersama teman, dan untuk operator event yang butuh booth sederhana.',
          'Untuk event penting, operator sebaiknya menyiapkan perangkat, browser, izin kamera, koneksi initial load, dan opsi upload lokal sebelum tamu mulai memakai aplikasi.',
        ],
      },
      {
        id: 'cakupan-stecute',
        title: 'Cakupan Stecute',
        body: [
          'Stecute fokus pada capture, upload lokal, review, retake per-shot, render PNG, output lokal, gallery 10 hasil terakhir, dan offline setelah cache.',
          'Login, cloud sync, QR delivery, payment, marketplace template, dan auto-reset event belum termasuk.',
        ],
      },
      {
        id: 'kontak',
        title: 'Kontak',
        body: [
          `Untuk pertanyaan, laporan bug, atau isu privasi, hubungi ${supportEmail}.`,
          'Untuk penggunaan event, pastikan operator sudah menguji browser, kamera, download, dan cache offline sebelum acara.',
        ],
      },
    ],
  },
} satisfies Record<PublicPageId, PublicPage>
