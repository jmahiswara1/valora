# Chat global Valora

## Job and direction

Mode: Operate. Pengguna membicarakan kondisi barang dan serah terima tanpa meninggalkan halaman yang sedang dibuka. Pertahankan White, Forest, Cream, Sage, Plus Jakarta Sans dan permukaan datar Valora.

## Entry points and routes

Keputusan pengguna 8 November 2026: desktop memakai tombol Pesan melayang di kanan bawah mulai 1200px. Ponsel/tablet di bawah 1200px dan perangkat sentuh dengan pointer kasar memakai ikon Pesan pada navbar publik, akun dan admin. Pemicu hanya untuk sesi login dan menampilkan jumlah pesan belum dibaca dari API, maksimum tampilan 99+; kegagalan menghitung tidak dianggap nol. Shortcut Favorit tetap tersedia; pada lebar hingga 360px, wordmark header diperkecil dan wordmark toolbar akun disembunyikan agar semua kontrol tetap 44px.

Klik biasa membuka dialog native pada halaman yang sama. Tombol expand berlabel Buka halaman chat penuh menuju /pesan atau /pesan/[id] sesuai percakapan aktif. Halaman tersebut berdiri sendiri dengan header publik dan tanpa sidebar/dashboard akun. /app/pesan dan /app/pesan/[id] hanya redirect kompatibilitas. Pesan dihapus dari sidebar pengguna dan admin. Tautan kontekstual dari Market, ringkasan, transaksi dan notifikasi memakai modal; href kanonis memungkinkan buka tab baru menuju halaman penuh.

## Dialog and layout

Desktop: dialog di kanan bawah, lebar maksimum 1280px, tinggi viewport dikurangi 32px, dan jarak viewport 16px. Ponsel hingga 600px: modal memenuhi viewport dinamis, tanpa inset atau sudut luar. Toolbar 56px dan padding konten yang lebih ringkas memprioritaskan histori pesan. Toolbar tetap memuat judul, expand dan tutup. Target ikon 44px. Native showModal menjaga fokus; Escape/backdrop menutup chat dan memulihkan fokus. Escape pada foto/konfirmasi hanya menutup dialog teratas. Scroll halaman asal dikunci selama modal terbuka.

Panel percakapan dan histori memakai scroll terpisah. Panel 280px, turun ke 260px hingga container 950px; hingga container 760px hanya inbox atau thread yang tampil, dengan Semua percakapan untuk kembali. Pencarian nama/barang dan filter Semua/Belum dibaca memakai data API yang dimuat (maksimum 100), tanpa mengubah cursor baca. Header dan footer intrinsik dibatasi tinggi agar histori dan composer tetap dapat dipakai. Foto menggunakan dimensi yang dipesan sebelum dimuat.

## Drafts, privacy and state

Draf per percakapan berada dalam memori sesi: teks, foto/tiket unggahan, status unggah, clientMessageId, pengiriman tertunda dan pemulihan respons tidak pasti. Draf bertahan saat dialog ditutup, berganti percakapan atau diperluas dengan navigasi client. Muat ulang penuh atau perubahan sesi menghapus draf; file tidak disimpan di browser storage. Object URL dibersihkan setelah foto dihapus, pesan terkonfirmasi tersimpan atau sesi berakhir. Satu SSE per sesi tetap digunakan.

Pesan hanya ditandai dibaca setelah benar-benar terlihat pada tab aktif dan dialog teratas. Membuka inbox, menerima SSE, atau membuka lightbox tidak menandai pesan tersembunyi. Pengiriman memakai idempotensi dan pemulihan yang sudah ada. Foto, blokir/laporan, tanda kirim/baca dan profil tetap tersedia. Loading, kosong, gagal/retry, akun dibatasi, logout belum pasti dan koneksi sesi gagal tidak membocorkan isi privat. Halaman penuh mempertahankan redirect login dengan next yang tervalidasi.

## Verification

Browser coverage includes desktop/mobile dialogs, navbar widths 320–1199px, desktop launchers from 1200px, expansion preserving text/photos, Escape/focus including nested photo dialogs, standalone auth/legacy redirects and session draft cleanup. Existing chat, transaction, notification and dashboard regressions remain applicable.

Validation on 8 November 2026: 108 desktop/mobile browser scenarios passed across chat (mocked and real API), dashboard, handover and notifications. A separate 1366px touch-tablet check confirmed navbar entry and modal behavior. Full web lint, TypeScript within the production build, the production build itself and diff whitespace checks passed. Desktop/mobile/tablet captures were visually checked; the detector's compact-wordmark typography advisory is covered by the documented wordmark-compact token.

## Ruang percakapan — 8 November 2026

Setelah umpan balik pengguna bahwa area chat terlalu kecil, modal desktop diperlebar dan ditinggikan mengikuti viewport. Riwayat tetap fleksibel dan menjadi bidang utama. Composer mulai dari satu baris (46px), tumbuh otomatis hingga 120px, dan pratinjau draf foto menjadi 80px. Batas foto tetap terbaca, sedangkan catatan kesepakatan dan status pembaruan dipersingkat. Pada 1440×900, histori modal dengan tautan kesepakatan harus memiliki lebar sekurangnya 900px dan tinggi 500px sebelum draf foto; pada 390×844 tinggi histori sekurangnya 400px. Expand, fokus, status baca dan draf tetap mengikuti kontrak sebelumnya.

Validation for the space correction: all 18 desktop/mobile chat browser scenarios passed, including minimum history geometry, attachment drafts, expanded routes, cursor visibility and independent scrolling. Web typecheck, focused lint and whitespace checks passed. Desktop/mobile screenshots were inspected together; the changed-source detector returned no findings.

Standalone header correction: /pesan scopes the shared SiteHeader inside a valora-surface wrapper with zero minimum height, so it inherits the same public navbar margins, height, logo and mobile behavior without applying public page styling to chat content. Browser geometry matched the default public header at 320, 390, 768, 1440 and 1920px; full-page chat remained within the viewport. Focused lint, web typecheck, whitespace and detector checks passed.
