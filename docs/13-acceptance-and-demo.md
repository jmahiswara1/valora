# Matriks penerimaan MVP dan skenario demo

**Status:** matriks penerimaan MVP karya INSYFEST 2026, disusun sebelum implementasi dan dipakai untuk verifikasi bertahap. Kriteria PRD tetap berlaku; dokumen ini memberi fixture dan hasil yang dapat diamati. Akun, foto, harga, dan chat demo memakai data sintetis berlabel **demo**. Tidak ada klaim pembayaran atau pemeriksaan fisik oleh Valora.

Implementasi tahap 1–6 sudah mempunyai pengujian bertahap; cakupan dan batas verifikasi terbaru dicatat pada [status tahap 6](21-stage6-implementation.md). Tahap 6 memperluas pemeriksaan seluruh matriks ini, termasuk [auth dan session management pada setiap halaman](20-stage6-auth-session-plan.md). Penjelasan Assessment saat ini memakai template sesuai keputusan pengguna.

## Fixture minimum yang dapat direset

| ID fixture | Peran dan keadaan awal |
| --- | --- |
| `ownerA`, `userB`, `userC` | Tiga akun User terverifikasi di kota Indonesia; `admin1` adalah Admin. |
| `itemKeyboard` | Elektronik milik A; Assessment `COMPLETE`, Score contoh 72 dari [rubrik](06-category-rubric-draft.md), Listing Resell `ACTIVE` setelah review. |
| `itemChair` | Furnitur milik B, Assessment `PARTIAL_ECONOMIC`, keselamatan lengkap, layak Exchange. |
| `itemTable` | Furnitur milik A, Assessment `COMPLETE`, keselamatan lengkap, tidak memiliki Listing aktif pada fixture awal; dipakai untuk Exchange. |
| `itemBook` | Buku milik A, Assessment `PARTIAL_ECONOMIC`, keselamatan lengkap, layak Donate. |
| `itemHobby` | Permainan papan milik C, data komponen inti lengkap, layak Exchange. |
| `itemUnsafe` | Elektronik dengan baterai dilaporkan menggembung; indikator numerik boleh tinggi tetapi Listing harus ditolak. |

Setiap skenario dimulai dari fixture reset kecuali dinyatakan berantai. Reset demo mengembalikan owner, revisi, Offer, Transaction, Passport, dan Impact ke keadaan awal yang diketahui. Data demo tidak dicampur dengan akun pribadi atau angka operasi nyata.

## Alur penerimaan utama

| Skenario | Langkah penting | Hasil yang wajib terlihat |
| --- | --- | --- |
| Evaluasi dan Repair | A menyelesaikan Assessment keyboard, mencatat Repair, lalu mengubah kondisi. | Komponen/Score sesuai `score-v1`; Repair tercatat sebagai laporan pemilik; perubahan material menaikkan revisi Item, Assessment lama historis, Listing aktif `PAUSED`, Offer revisi lama `EXPIRED`. |
| Resell | B dan C mengirim Offer pada keyboard; A Counteroffer ke B, B menerima revisi harga dan langsung membuat Transaction. Setelah penyerahan/penerimaan, Transaction selesai. | Harga final dari `OfferRevision`, chat tidak mengubahnya; tepat satu Offer diterima; Listing `RESERVED → CLOSED`; owner menjadi B hanya setelah dua konfirmasi; satu Transfer, satu event Passport transfer, satu Completed Transfer dan nilai jual pada Impact. |
| Exchange | A menawarkan `itemTable`, B menawarkan `itemChair`; keduanya memenuhi kelayakan. Catat empat konfirmasi. | Kedua Item reserved; sebelum konfirmasi keempat, owner tetap; sesudahnya dua owner berubah dalam satu commit, dua Transfer dan dua timeline; tidak ada harga jual. |
| Donate parsial | C meminta `itemBook`; A menerima, kedua pihak konfirmasi. | Assessment tetap `PARTIAL_ECONOMIC` dan Score/label `null`; Listing dapat aktif karena keselamatan lengkap; owner berpindah sesudah dua konfirmasi; tidak ada `Confirmed Sale Value`. |
| Moderasi | Ajukan `itemUnsafe`, Item dengan jawaban keselamatan `TIDAK_TAHU`, dan kasus review khusus dari matriks kategori. | Kondisi terlarang tidak terbit; yang tidak lengkap tertahan dengan pertanyaan jelas; kasus khusus masuk antrean admin; semua Listing yang layak tetap menunggu review dan keputusan beralasan. |
| Passport dan privasi | B membuka Passport keyboard setelah Resell; Guest membuka Passport publik; admin membatasi satu riwayat. | B melihat ringkasan Repair lama tetapi tidak biaya/chat/alamat/bukti privat; Guest hanya proyeksi publik; `LIMITED` menampilkan status tanpa event, `HIDDEN` memberi `404`, semua perubahan diaudit. |
| Sengketa dan pembatalan | Pada Transaction tertunda, satu pihak meminta batal; pihak lain menolak lalu sengketa. Admin memutuskan. | Tidak ada owner baru otomatis; konfirmasi terdahulu tetap; putusan mencatat alasan dan asal penyelesaian; pembatalan melepas reservasi dan memvalidasi Listing ulang. |
| Impact dan koreksi | Batalkan logis RepairRecord salah, koreksi berat transfer, ulangi request koreksi. | Ledger menambah delta sekali per sumber/kunci; agregat berubah sesuai delta; atribusi historis tetap; retry tidak menggandakan angka. |
| AI Explainer | Minta penjelasan Assessment lengkap dan parsial, lalu simulasikan kegagalan penyedia AI. | Score/status tetap dari mesin aturan; parsial tidak diberi Score rekaan; fallback template tetap menjelaskan data dan batasnya. |

## Kasus batas teknis yang wajib lulus

1. Dua penerimaan Offer bersamaan pada Item sama: tepat satu Transaction/seleksi; yang kalah menerima konflik terstruktur. Dua Exchange yang bersaing atas Item penawar juga tidak dapat mereservasi ganda.
2. Konfirmasi terakhir dikirim dua kali dengan `Idempotency-Key` sama: satu hasil selesai, satu transfer per Item, dan satu set event Passport/Impact. Payload berbeda dengan kunci sama ditolak.
3. Simulasikan kegagalan di tengah penyelesaian Exchange: kedua owner dan semua event tetap seperti sebelum operasi.
4. Counteroffer memperbarui tenggat tujuh hari; Offer melewati tenggat server tidak dapat diterima. Transaction melewati target 14 hari tetap tidak selesai/batal otomatis; pengingat hari 7/12 dibuat sekali.
5. Perubahan material Listing mengakhiri Offer pada revisi lama. `REJECTED` dapat diajukan ulang dengan revisi baru; `WITHDRAWN` terminal; `SUSPENDED` hanya kembali lewat review.
6. `Economic Value` diuji tepat pada `0`, `0,10`, `0,30`, `0,60`, sedikit di atas tiap batas, biaya melebihi nilai jual, pembanding nol, dan data ekonomi kosong. Komponen dan total memakai pembulatan `.5` ke atas.
7. Guest/User lain tidak dapat membaca Item draft, Conversation, alamat, foto privat, detail Repair lama, atau proyeksi admin melalui API. Admin tanpa kasus tidak dapat membaca chat.
8. Upload menolak konten bukan gambar, ukuran/jumlah berlebih, dan metadata lokasi pada salinan publik. Timeout jaringan pada aksi penting ditangani dengan pengecekan status atau retry idempoten.

## Pemeriksaan UI dan rujukan Pencil

Uji desktop 1440 px dan mobile 390 px untuk Market, formulir Assessment, Detail Listing, chat, Transaction, Passport, serta antrean admin. Setiap layar harus memiliki keadaan kosong, memuat, berhasil, gagal, dan tidak berhak yang relevan. Teks panjang Bahasa Indonesia, rupiah, fokus keyboard, label status selain warna, dan tanpa scroll horizontal termasuk kriteria penerimaan. [Audit Pencil](04-pencil-design-review.md) dan [design system](08-design-system.md) menetapkan token `v1`; badge “TERVERIFIKASI” yang tidak didukung dan angka stok contoh harus dihapus atau diganti data nyata dalam implementasi. Kanvas Pencil tetap referensi visual; rincian perilaku pada docs ini menjadi acuan ketika frame referensi belum lengkap.

## Bukti demo yang disiapkan setelah implementasi

Satu reset fixture, rekaman atau urutan langkah empat jalur, tangkapan layar desktop/mobile, hasil uji kasus batas, contoh log audit tanpa data privat, dan penjelasan singkat batas klaim. Format pengumpulan mengikuti panduan INSYFEST 2026 jika kemudian tersedia. Kesiapan demo tidak menyatakan kesiapan operasi perdagangan publik; keputusan O11 tetap terpisah.

## Bukti implementasi tahap 4

Smoke API tiga jalur, penerimaan/Exchange bersamaan, rollback terinjeksi, idempotensi, privasi, sengketa/admin, pengingat, dan penutupan akun tersedia pada `apps/api/scripts/smoke-stage4.mjs`. Uji UI peserta/admin desktop 1440 px dan mobile 390 px tersedia pada `apps/web/tests/stage4.spec.mjs`. Fixture demo dapat dibuat ulang sebagai salinan baru melalui `pnpm demo:stage4`; ledger historis tidak direset. Cakupan aktual dan pekerjaan tahap 5/6 tercatat pada [implementasi tahap 4](18-stage4-implementation.md).

## Tambahan penerimaan tahap 6 — auth dan session management

**Status:** tahap 6 terverifikasi melalui smoke tahap 1–6 dan 16 E2E desktop/mobile; hasil dan batas verifikasi dicatat pada [implementasi tahap 6](21-stage6-implementation.md#verifikasi). Inventaris seluruh `page.tsx` harus mempunyai klasifikasi akses dan bukti, termasuk rute detail dinamis serta navigasi melalui URL langsung, refresh, tautan, dan history browser. Pemeriksaan UI berlaku pada desktop 1440 px dan mobile 390 px.

| Skenario | Hasil yang wajib terlihat |
| --- | --- |
| Guest membuka halaman publik dan halaman privat/admin | Publik tetap dapat dibaca. Konten/query privat tidak dijalankan sebelum autentikasi. Rute privat membawa pengguna ke login dengan tujuan internal yang aman. |
| User membuka seluruh rute admin | Guard bersama menampilkan state tidak berhak tanpa sempat memuat data admin; akses API tetap ditolak. |
| Sesi berakhir/dicabut pada setiap halaman dan saat tab kembali aktif | State sesi diperbarui, data privat disembunyikan/dibersihkan, tindakan privat dihentikan, dan masuk kembali tersedia dengan pemberitahuan yang jelas. |
| Login dan kembali ke tujuan awal | Tujuan sah dipulihkan sesuai aktor/izin. URL eksternal, loop login, dan tujuan admin bagi User ditolak. Halaman login/daftar menangani sesi aktif secara konsisten. |
| Logout lalu Back/Forward atau respons API lama datang | Data privat tidak muncul kembali; query/SSE lama berhenti dan respons aktor lama tidak mengisi cache baru. Logout timeout mempunyai state belum pasti dan retry. |
| Logout/pergantian akun pada tab A, tab B berisi data privat | Tab B mengonfirmasi perubahan ke server dan memperbarui state. Akun B tidak melihat akun A, draft, pesan, grant, hasil penjelasan, atau payload tindakan A. |
| Akun belum terverifikasi, ditangguhkan, ditutup, atau grant kasus berakhir | UI mengikuti kemampuan/penyebab yang benar. Verifikasi memperbarui kemampuan akun; perbedaan error tidak menyebabkan loop logout yang keliru. |
| Offline/timeout/5xx pada pemeriksaan sesi atau aksi penting | Gangguan koneksi tidak dianggap logout/sesi berakhir. Setelah koneksi pulih, status server diperiksa; mutasi tidak dikirim ulang otomatis. |
| Daftar sesi dan pencabutan sesi tertentu/sesi lain | Hanya sesi aktif akun sendiri ditampilkan dengan tanda sesi saat ini dan metadata aman. Aktor lain tidak dapat membaca/mencabutnya. Pencabutan berulang aman; tab/perangkat terdampak mengikuti revokasi server. |
| Reset/ubah kata sandi, penutupan/penangguhan akun, dan revokasi bersamaan dengan aksi | Aturan pencabutan server tetap berlaku pada browser/tab lain. Permintaan berikutnya tidak dapat memakai sesi dicabut; hasil aksi yang bersaing mengikuti kebijakan yang diverifikasi. |
| Masuk kembali setelah hasil transaksi/koreksi belum pasti | Pemulihan dibatasi pada aktor asal dan memakai status/idempotensi server. Akun berbeda tidak meneruskan payload, dan UI tidak menganggap mutasi berhasil sebelum status pasti. |
| Cookie/token/CSRF dan token verifikasi/reset | Token sesi tidak tersedia di JS/URL/localStorage/log; metadata daftar sesi tidak berisi token/hash. CSRF dan token sekali pakai tetap ditegakkan. |
