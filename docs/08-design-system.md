# Design system MVP Valora

**Status:** redesign publik tahap pertama dengan koreksi kanvas penuh dan refinement navbar sticky, 3 Oktober 2026, mengikuti [PRD v1.17](../PRD.md) dan referensi pengguna. Beranda, Cara Kerja, Impact publik, serta header/footer memakai sistem baru. [DESIGN.md](../apps/web/DESIGN.md) dan [sidecar desain](../apps/web/.impeccable/design.json) mencatat token serta pola implementasi. Kanvas Pencil dan [audit desain](04-pencil-design-review.md) menjadi catatan historis.

## Arah visual yang dipakai sebagai dasar

Referensi pengguna memberi struktur foto hero besar, dua panel editorial, filter kategori pill, dan kartu dengan foto dominan. Valora menerjemahkannya menjadi marketplace berbagai barang: permukaan putih, teks dan aksi hijau, sedikit cream/sage, garis tipis, sudut membulat, serta tanpa shadow. Foto hero memuat furnitur, buku, elektronik, dan benda rumah tangga; foto Listing tetap mengikuti barang yang ditawarkan.

| Peran token | Nilai implementasi | Catatan |
| --- | --- | --- |
| Forest / ink utama | `#1B3A28` | Teks penting, navigasi aktif, tombol primer. |
| Green sekunder | `#2D5E3A` | Aksen terukur pada area editorial. |
| Cream / latar | `#F5F3EE` | Aksen panel editorial, penutup, dan fallback media. |
| White | `#FFFFFF` | Permukaan utama, form, tabel, dan konten. |
| Sage | `#DDE6D8` | Bidang informasi sekunder. |
| Lime | `#D2E2A9` | Aksen kecil dengan teks gelap. |
| Muted text | `#5B6D60` | Metadata/teks sekunder, bukan placeholder yang sangat pudar. |
| Line | `#CAD4C7` | Border 1 px dan pemisah. |
| Surface line | `#E2E8DF` | Border kartu, kontrol, dan pemisah publik baru. |
| Soft sage | `#EDF1EA` | Panel Passport dan metrik pendukung. |
| Danger | `#A33A2B` | Teks/status kesalahan; selalu disertai label. |
| Warning text | `#8C5A10` | Variabel Pencil `#9A6818` kurang kontras untuk teks kecil di atas Cream. |
| Info | `#315B72` | Teks/status informasi; selalu disertai label. |

Semua halaman publik, akun, user, dan admin memakai `Plus Jakarta Sans`, menggantikan `Newsreader`, `Funnel Sans`, dan `IBM Plex Mono`. Font disajikan dari aplikasi melalui Fontsource, tanpa permintaan font ke layanan eksternal. CSS memakai token `--font-ui`, dengan fallback `Arial, sans-serif`.

| Peran | Bobot | Penggunaan |
| --- | ---: | --- |
| Teks utama | 500 (medium) | Paragraf, input, metadata, dan teks pendukung. |
| Label/tindakan | 600 (semibold) | Tombol, label form, eyebrow, badge, dan inisial avatar. |
| Judul/angka utama | 700 (bold) | Heading, wordmark, harga utama, Score, dan metrik Impact/admin. |

Bobot normal 500/600/700 dan italic 500 dimuat sebagai font asli. Heading memakai line-height `1.15` dan pembungkusan seimbang; harga dan metrik memakai angka tabular. Ukuran heading disesuaikan bila diperlukan untuk menjaga teks Indonesia tetap utuh pada layar kecil.

## Pemeriksaan kontras token

Rasio dihitung dari kode warna di atas. Target minimum teks normal adalah 4,5:1; warna status tetap membutuhkan teks/ikon eksplisit.

| Pasangan | Rasio | Hasil |
| --- | ---: | --- |
| Forest / Cream | 11,26:1 | Lulus |
| Muted / Cream | 4,98:1 | Lulus untuk teks normal |
| Forest / White | 12,48:1 | Lulus |
| Forest / Lime | 9,03:1 | Lulus |
| Danger / Cream | 5,92:1 | Lulus |
| Warning Pencil `#9A6818` / Cream | 4,34:1 | Belum cukup untuk teks normal |
| Warning terpilih `#8C5A10` / Cream | 5,28:1 | Lulus |
| Info / Cream | 6,60:1 | Lulus |

Rasio ini memeriksa pasangan token, bukan setiap kombinasi pada semua layar. Saat implementasi, kombinasi nyata pada hover, disabled, focus, badge, dan dialog tetap harus diuji.

## Tata letak dan komponen

- Kanvas publik putih memenuhi lebar layar dengan tinggi minimum satu viewport, margin luar 0, border 0, dan radius 0. Isi melebar mengikuti layar dengan gutter 24 px di desktop/tablet dan 16 px hingga 639 px, tanpa batas maksimum. Header, hero, grid, dan footer sejajar pada gutter yang sama. Paragraf langkah, catatan kecil, dan paragraf Passport pada Cara Kerja memakai lebar baca maksimum 70ch.
- Tidak ada shadow dekoratif. Gunakan ruang kosong, perbedaan latar, dan garis 1 px. Radius kontrol/foto kecil 12 px, kartu/panel 16 px, hero 24 px (20 px di ponsel), serta tombol/filter pill 999 px.
- Preview Listing Beranda memakai tiga kolom desktop, dua kolom tablet, dan satu kolom ponsel. Ini menjadi dasar tahap redesign Market; Market yang belum dimigrasi masih memakai grid sebelumnya. Dua panel editorial berubah menjadi satu kolom pada ponsel, sedangkan empat langkah ringkas menjadi dua kolom.
- Foto memiliki rasio crop konsisten. Pada demo lomba, gunakan foto yang sesuai dengan Item contoh dan tandai datanya sebagai demo; pada operasi nyata, foto harus menampilkan Item yang benar-benar ditawarkan. Overlay promosi tidak boleh menyembunyikan kondisi, jenis Listing, harga, atau status Score.
- Komponen dasar: header publik, navigasi user/admin, kartu Listing, filter, form Item/Assessment, status, panel penjelasan Score, timeline Passport, daftar percakapan, pesan, detail Offer/Transaction, tabel admin, dialog konfirmasi, dan banner kegagalan jaringan.
- Semua komponen interaktif memiliki focus keyboard yang terlihat, label yang dapat dibaca tanpa warna, serta varian default, hover, focus, disabled, loading, empty, error, dan success.

## Batas implementasi bertahap

| Tahap | Area | Status |
| --- | --- | --- |
| 1 | Beranda, Cara Kerja, Impact publik, header/footer, token publik, preview Market | Diimplementasikan. |
| 2 | Login, register, dan halaman terkait akun | Tahap berikutnya. |
| 3 | Market, pencarian/filter, serta detail Listing | Redesign visual berikutnya; filter awal dari URL kategori sudah didukung. |
| 4 | Dashboard pengguna dan admin | Redesign berikutnya sesuai kebutuhan kerja tiap peran. |

`PublicShell` mengaktifkan CSS `.valora-surface` hanya pada halaman tahap pertama. `SiteHeader`/`SiteFooter` memakai varian `renewed` di dalam shell ini. Komponen `MarketCard` digunakan ulang oleh Beranda dan Market; styling barunya berlaku di dalam shell, sementara Market mempertahankan styling yang sudah ada.

Refinement navbar mengikuti referensi ikon pengguna pada 3 Oktober 2026. Seluruh `SiteHeader` publik sekarang sticky di tepi atas, memakai latar putih tanpa border atau shadow; lingkaran tipis ikon tetap ada. Sisi kanan berisi Cara kerja, Impact, serta ikon bulat pengingat transaksi, penawaran, dan akun. Ikon memiliki area interaksi 44 px dan lingkaran visual 34 px. Tautan teks masuk ke menu hingga 700 px; ketiga ikon tetap terlihat. Menu terbuka di bawah header dan mempertahankan Escape serta pengembalian fokus. Scroll offset menjaga target anchor tetap terlihat. Perubahan header bersama ini tidak memigrasikan isi halaman akun, Market, atau dashboard.

Panel Passport Beranda memakai tiga kartu bertumpuk: Profil barang, Kondisi & perawatan, dan Cerita berikutnya. Judul kartu bisa dipilih dengan pointer atau keyboard untuk membawa kartu ke depan. Contoh kursi dan tahun 2026 dilabeli sebagai ilustrasi Passport; informasi penilaian/perawatan belum dicatat. Animasi transform mengikuti reduced motion. Komponen dan aturan responsifnya dicatat pada `apps/web/DESIGN.md`, dengan bukti terfokus di `apps/web/.impeccable/review/passport-stack/`.

Footer mengganti deskripsi merek dengan penanda visual Instagram, TikTok, Gmail, dan YouTube tanpa tautan, sesuai keputusan pengguna menunggu akun resmi. Wordmark diperbesar, dan navigasi dibagi menjadi Jelajahi (Market, Cara kerja, Impact) serta Akun (Daftar, Masuk). Seluruh footer menjadi kartu Forest membulat, dengan gutter luar 24px/16px dan inset konten yang disamakan dengan padding card “Mulai dari satu barang.”: 40px desktop, 32px tablet, dan 28px ponsel.

Beranda mengambil kategori dari `/categories` dan hingga enam Listing aktif dari `/market`. Filter mempertahankan kategori pada tautan ke Market, memiliki state loading/error/empty dengan pemulihan, dan menampilkan fallback bila foto tidak ada atau gagal. CTA pencatatan mengarah ke pendaftaran bagi tamu dan form barang bagi pengguna yang sudah masuk.

Cara Kerja menjelaskan pencatatan, penilaian, pilihan tindakan, dan kesepakatan/serah terima yang sudah diterapkan. Impact publik tetap memakai lima metrik, pilihan periode Asia/Jakarta, serta catatan sumber dari API `/impact/public`.

## Interaksi dan aksesibilitas publik

- Tombol utama setinggi minimal 48 px; tombol kecil serta pill kategori minimal 44 px. Menu mobile dapat ditutup dengan Escape dan mengembalikan fokus ke pemicunya.
- Skip link menuju konten utama, navigasi aktif memakai `aria-current`, dan kategori memakai `aria-pressed`. Focus ring hijau 3 px dengan offset 4 px.
- Perubahan warna/border memakai 150–200 ms. Zoom foto saat hover hanya berlaku pada perangkat yang mendukung hover dan tanpa preferensi reduced motion. Reduced motion mematikan transisi/animasi; kategori terpilih tetap ditandai dalam forced colors.
- Foto hero memakai Next Image dengan preload; foto Listing lazy loading dan fallback. Rasio foto kartu 4:3, dengan teks judul serta kondisi di luar foto.
- Hero menjaga headline dan CTA terbaca di layar awal ponsel melalui crop dan lapisan hijau gelap yang datar.

## Aset dan bukti implementasi

Foto hero dihasilkan dengan imagegen, sementara foto kursi/buku panel berasal dari katalog demo lokal. Prompt/origin tercatat dalam metadata ketiga raster di `apps/web/public/images/editorial/` dan [catatan aset](../apps/web/.impeccable/asset-prompts.md). Foto hero adalah ilustrasi editorial; foto dan label Listing tetap memakai data API. Atribut `sizes` mengikuti lebar kanvas dan kolom baru agar resolusi yang dimuat sesuai ukuran gambar.

Typecheck, lint, dan build produksi berhasil setelah koreksi kanvas. Lima skenario browser pada empat ukuran layar (20 kasus total) mencakup filter kategori dan tautan detail, jenis Listing/foto gagal/teks panjang, pemulihan API, metrik/periode Impact, serta CTA dan navigasi keyboard. Screenshot produksi ketiga halaman pada 390, 768, 1.440, dan 1.920 px disimpan di `apps/web/.impeccable/review/flat-layout/`. Seluruh 12 kombinasi halaman/ukuran memiliki kanvas putih penuh, gutter 24/16 px sesuai breakpoint, dan tidak memiliki scroll horizontal halaman. [Catatan verifikasi](../apps/web/.impeccable/review/flat-layout/verification.md) merinci bukti pemeriksaan.

Matriks 20 kasus tersebut mendahului refinement navbar sticky. Typecheck, lint, dan build diulang untuk navbar baru; bukti render navbar berada di `apps/web/.impeccable/review/navbar/` dan mencakup posisi awal, scroll, serta menu ponsel.

## State dan copy yang perlu ditambahkan pada referensi

| Area | State/copy yang harus terlihat |
| --- | --- |
| Score | `INCOMPLETE`, `PARTIAL_ECONOMIC`, Score lengkap, sumber data, `ruleVersion`, empat komponen bila ada, alasan `ELIGIBLE`/`INELIGIBLE`/`NEEDS_DATA`. |
| Market/Listing | `ACTIVE`, `PAUSED`, `RESERVED`, Score belum tersedia pada Donate/Exchange parsial, alasan Listing tidak tersedia, Offer kedaluwarsa karena waktu atau `LISTING_REVISED`. |
| Chat/Offer | Pesan tidak menjadi persetujuan formal; nominal final ada di Offer/Counteroffer; unread dan kegagalan realtime punya fallback. |
| Transaction | Pembayaran/serah terima di luar Valora, target 14 hari, pengingat, terlambat, permintaan batal, empat konfirmasi Exchange, sengketa, dan keputusan admin. |
| Passport/Impact | Sumber event, batas visibilitas, label laporan pengguna, metrik tanpa klaim CO₂, serta status publik/privat sesuai riwayat Listing dan transfer. |
| Admin | Alasan wajib, preview dampak keputusan, audit akses chat, dan larangan tindakan massal tanpa jejak. |

Badge **“TERVERIFIKASI”** pada contoh Market harus dihapus dari spesifikasi komponen sampai ada jenis verifikasi yang benar-benar dilakukan dan dijelaskan secara eksplisit. Angka contoh seperti “128 barang aktif” hanya boleh muncul dari data nyata; saat kosong, tampilkan empty state yang jujur.

## Kriteria saat implementasi UI

1. Gunakan token publik pada [DESIGN.md](../apps/web/DESIGN.md), warna pada dokumen ini, dan Plus Jakarta Sans. Kanvas Pencil tidak perlu diubah.
2. Terapkan migrasi sesuai tahapan yang disetujui; pertahankan fungsi, akses, serta state produk pada setiap halaman. [Audit Pencil](04-pencil-design-review.md) tetap berguna sebagai catatan kekurangan state historis.
3. Periksa hasil kode pada 390, 768, 1.440, dan 1.920 px untuk gutter, teks panjang Indonesia, angka rupiah, keyboard focus, dan tidak adanya scroll horizontal halaman atau elemen terpotong.
4. Uji copy klaim pada hasil kode: Score menurut data pemilik, konfirmasi transfer bukan verifikasi fisik/pembayaran, dan Impact hanya metrik aktivitas yang didefinisikan.
