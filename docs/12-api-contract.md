# Kontrak API MVP Valora

**Status:** kontrak perilaku REST v1 untuk MVP penuh. Prefix `/api/v1`; JSON UTF-8; waktu ISO 8601 UTC; ID UUID; nominal integer rupiah. Endpoint boleh diberi nama internal berbeda hanya bila semua perilaku, otorisasi, dan respons di sini tetap tersedia. [Model data](11-data-model.md) dan [aturan produk](01-product-decisions.md) adalah acuannya.

**Tahap 1–5 berjalan:** Auth/User, katalog, Item, media, rubrik, Assessment, Repair, Market, Listing, moderasi, Offer/Counteroffer, chat, block, dan laporan sudah tersedia dalam cakupan yang dijelaskan di [catatan tahap 3](17-stage3-implementation.md) dan [tahap 4](18-stage4-implementation.md), termasuk penerimaan Offer, Transaction, bukti/putusan sengketa, dan ledger transfer. Passport/Impact, koreksi, rubrik/acuan, operasi admin, retensi, dan penjelasan template juga tersedia sesuai [catatan tahap 5](19-stage5-implementation.md).

## Aturan lintas endpoint

- Auth memakai sesi cookie `HttpOnly`, `Secure`, `SameSite=Lax` pada origin aplikasi; operasi perubahan data memerlukan proteksi CSRF bila memakai cookie. Guest hanya memakai endpoint publik. Status akun dan owner terkini diperiksa pada API setiap permintaan.
- Implementasi lokal tahap 1 memakai `Secure=false` hanya pada HTTP localhost. Browser mengambil `GET /auth/csrf`, lalu mengirim `X-CSRF-Token` pada setiap `POST`, `PATCH`, `PUT`, atau `DELETE`; cookie sesi tetap `HttpOnly`. Pada deployment HTTPS, cookie `Secure=true`.
- Respons sukses adalah objek `{ data, meta? }`; daftar memakai `{ data: [...], meta: { nextCursor } }`. `limit` default 20, maksimum 50; pengurutan stabil memakai waktu lalu ID. `GET` tidak mengembalikan field privat lalu menyembunyikannya di browser.
- Error adalah `{ error: { code, message, details?, requestId } }`. `message` aman dibaca pengguna; `details` hanya menyebut field/aksi yang perlu diperbaiki dan tidak membuka keberadaan data privat milik orang lain.
- Mutasi kritis (`accept`, konfirmasi, cancel, putusan sengketa, koreksi) wajib membawa `Idempotency-Key` UUID. Pengulangan payload yang sama mengembalikan status/body semula; kunci sama dengan payload berbeda memberi `409 IDEMPOTENCY_CONFLICT`.
- Mutasi atas snapshot mengirim `expectedVersion` atau `If-Match`. Versi/revisi yang tidak cocok memberi `409 STATE_CONFLICT` dengan status terkini yang boleh dibaca aktor. Server menggunakan waktu server untuk expiry, bukan waktu browser.
- Unggahan foto memakai tiket unggah setelah pemeriksaan akun/Item, lalu finalisasi yang memeriksa konten, ukuran, dan metadata. Untuk foto pertama, `POST /media/tickets` dibuat sebelum Item ada; `PUT /media/uploads/{ticketId}` mengirim bytes gambar; `POST /items` wajib menyertakan `uploadTicketIds` berisi 1–8 tiket terunggah. Pembuatan Item dan konsumsi tiket atomik. Foto tambahan memakai `POST /items/{id}/media/tickets`, `PUT /media/uploads/{ticketId}`, lalu `POST /items/{id}/media/finalize`. Tiket `REPAIR_EVIDENCE` terkait Item dikonsumsi saat membuat Repair. URL media privat hanya diberikan kepada aktor yang berhak menurut jenis media.

## Endpoint publik dan akun

| Method dan path | Akses | Request utama | Hasil |
| --- | --- | --- | --- |
| `POST /auth/register` | Guest | `email`, `password`, `displayName`, `cityId` | Akun belum terverifikasi; tautan sekali pakai dikirim. |
| `POST /auth/verify-email` | Pemegang token | `token` | `emailVerifiedAt`; token habis/terpakai ditolak. |
| `GET /auth/csrf` / `POST /auth/verification/resend` | Guest | — / `email` | Token anti-CSRF dan permintaan kirim ulang yang tidak mengungkap status akun. |
| `POST /auth/login` / `POST /auth/logout` | Guest / User | Kredensial / sesi | Sesi dibuat/dicabut tanpa mengembalikan `passwordHash`. |
| `POST /auth/password-reset/request` / `POST /auth/password-reset/confirm` | Guest | Email / token dan kata sandi baru | Respons permintaan tidak mengungkap ada/tidaknya email. |
| `GET /me` / `PATCH /me` | User | Profil dan kota | Hanya data diri sendiri; email change memerlukan verifikasi ulang. |
| `PATCH /me/password` | User | `currentPassword`, `newPassword` | Ubah kata sandi dan cabut sesi lain. |
| `POST /me/close` | User | Alasan opsional | Permintaan penutupan menurut K05; kasus/Transaction aktif dilaporkan. |
| `GET /cities` | Publik | `q` opsional | Kabupaten/kota Indonesia; pencarian nama atau provinsi. Snapshot lokal memuat 514 kota/kabupaten. |
| `GET /categories` / `GET /categories/{code}/rubric` | Publik | Subkategori opsional | Kategori aktif, pilihan formulir berversi, dan label asal Score. |
| `GET /market` | Publik | `q`, `category`, `type`, `cityId`, `condition`, `minPriceIdr`, `maxPriceIdr`, `sort`, `cursor`, `limit` | Hanya Listing `ACTIVE`; harga filter hanya Resell; urutan default terbaru lalu ID. |
| `GET /market/{listingId}` | Publik | ID | Snapshot publik Listing aktif; `RESERVED` hanya halaman status terbatas dari tautan yang sudah ada, tanpa aksi Offer baru. |
| `GET /market/{listingId}/media/{mediaId}` | Publik | ID Listing dan media | Foto hanya tersedia jika media termasuk revisi terkini Listing `ACTIVE`. |
| `GET /passport/{itemId}` | Publik sesuai D14/K04 | ID | Proyeksi publik `PUBLIC` atau status `LIMITED`; `HIDDEN`/privat memberi `404`. |
| `GET /impact/public` | Publik | `from`, `to` | Agregat platform dengan definisi, unit, dan label estimasi; data demo berlabel demo. |

## Endpoint User

| Method dan path | Guard utama | Hasil |
| --- | --- | --- |
| `GET /items` / `POST /items` / `GET /items/{id}` / `PATCH /items/{id}` | Owner untuk detail/mutasi; Item draft boleh dibuat sebelum verifikasi email. | Item milik sendiri; edit material menaikkan `itemRevision`, menandai Assessment tidak terkini, dan mem-pause Listing aktif dalam operasi konsisten. Edit material Item `RESERVED` ditolak sampai pembatalan/sengketa ditangani. |
| `POST /items/{id}/media/tickets` / `POST /items/{id}/media/finalize` / `DELETE /items/{id}/media/{mediaId}` | Owner, batas K05 | Tiket dan media terproses; penghapusan foto material memicu evaluasi Listing. |
| `POST /media/tickets` / `PUT /media/uploads/{ticketId}` / `GET /media/{mediaId}/access` / `GET /media/private/{mediaId}` | Owner | Tiket awal, unggah berkas, dan akses foto privat melalui URL bertanda tangan lima menit. |
| `POST /items/{id}/assessments` / `GET /items/{id}/assessments` / `GET /assessments/{id}` | Owner; rubrik aktif | Snapshot jawaban, status, komponen, Score nullable, alasan dan rekomendasi. Tidak menerima Score buatan client. |
| `POST /items/{id}/repairs` / `GET /items/{id}/repairs` / `POST /repairs/{id}/void` | Owner/pembuat; alasan void | RepairRecord dan event koreksi; perubahan kondisi membuat Assessment lama tidak terkini. |
| `POST /repairs/{id}/corrections` | Pembuat/admin kasus; alasan dan versi | Koreksi detail Repair yang tetap sah melalui revisi/event; tidak membuat hitungan Repair baru. |
| `POST /items/{id}/listings` / `PATCH /listings/{id}` / `POST /listings/{id}/submit` | Owner terverifikasi, Assessment terkini, tipe `ELIGIBLE` | Listing draft/revisi; submit `PENDING_REVIEW` atau error gerbang yang spesifik. |
| `POST /listings/{id}/withdraw` / `GET /listings/mine` | Owner; hanya status yang diizinkan | `WITHDRAWN` terminal dan Offer tertunda berakhir; Listing reserved mengikuti pembatalan/sengketa. |
| `POST /listings/{id}/conversations` / `GET /conversations` / `GET /conversations/{id}/messages` / `POST /conversations/{id}/messages` | User terverifikasi, peserta Conversation; pesan teks saja | Conversation dan histori cursor; `clientMessageId` mencegah pesan ganda. Block mencegah pesan baru tetapi aksi Transaction/Report tetap tersedia. |
| `POST /blocks` / `DELETE /blocks/{userId}` | User terverifikasi, bukan diri sendiri | Blokir/cabut blokir pesan baru; histori dan bukti kasus tidak dihapus. |
| `POST /listings/{id}/offers` / `GET /offers/{id}` / `GET /offers/mine` | User terverifikasi, bukan owner; Listing aktif, revisi terkini | Offer Resell (nominal), Exchange (satu Item sendiri yang layak), atau Donate (permintaan). `expiresAt` tujuh hari. |
| `POST /offers/{id}/counter` / `POST /offers/{id}/accept` / `POST /offers/{id}/reject` / `POST /offers/{id}/withdraw` | Hanya pihak yang berhak sesuai revisi/status | Counteroffer Resell membuat revisi; accept atomik membuat Transaction/reservasi; chat tidak dipakai sebagai persetujuan. |
| `GET /transactions/{id}` / `GET /me/transactions` | Peserta atau admin kasus | Status, target serah terima, pihak, konfirmasi yang sah, harga final Resell, asal penyelesaian. |
| `POST /transactions/{id}/confirmations` | Peserta untuk aksi/Item miliknya, idempotency key | Satu konfirmasi `HANDED_OVER`/`RECEIVED`; konfirmasi terakhir dapat menyelesaikan Transaction atomik bila tidak sengketa. |
| `POST /transactions/{id}/cancellation-requests` / `POST /transactions/{id}/cancellation-requests/{requestId}/respond` | Peserta; alasan dan persetujuan formal | Dua persetujuan membatalkan; penolakan/tidak respons dapat menuju sengketa. |
| `POST /transactions/{id}/disputes` / `POST /reports` | Peserta/pelapor berhak | Kasus baru, status `DISPUTED` untuk Transaction; bukti privat tetap terjaga. |
| `GET /notifications` / `POST /notifications/{id}/read` | Penerima notifikasi | Unread count, pengingat hari 7/12, dan status review tanpa data pihak lain. |
| `GET /items/{id}/passport` / `GET /me/impact` | Owner/proyeksi diri | Timeline owner dengan batas data owner lama; metrik User sesuai atribusi ledger. |
| `POST /assessments/{id}/explain` | Pembuat/owner berhak | Penjelasan terstruktur dari AI atau template fallback, `source: AI|TEMPLATE`, tanpa mengubah Assessment. |

## Kontrak tahap 2 yang berjalan

- `GET /categories/{code}/rubric?subcategoryCode=...` mengembalikan rubrik aktif, versi `score-v1`/`policy-v1`/`recommendation-v1`, enam pertanyaan dengan lima pilihan berteks, deklarasi keselamatan, dan pertanyaan konteks bila diperlukan. Sembilan target awal diterbitkan sebagai snapshot immutable. Hobi tanpa subkategori tetap dapat disimpan sebagai Item draft, tetapi tidak memiliki rubrik aktif untuk Assessment.
- `POST /items/{id}/assessments` menerima `expectedItemRevision`, `rubricVersionId`, kode pilihan indikator, `hasIssue`, `repairNeeded`, jawaban keselamatan `TIDAK`/`YA`/`TIDAK_TAHU`, konteks, dan tiga input ekonomi opsional. Setiap input ekonomi yang diberikan adalah objek `{ amountIdr, sourceType, sourceNote, referenceDate }`; server menambah `reportedBy`. Sumber admin belum diterima sebelum acuan admin bersumber diterbitkan. Input kurang lengkap menghasilkan snapshot `INCOMPLETE` atau `PARTIAL_ECONOMIC` yang sah; server menghitung komponen, Score, alasan, dan rekomendasi. `repairabilityReason: NOT_NEEDED` disimpan bila tidak perlu Repair.
- `GET /items/{id}/assessments` dan `GET /assessments/{id}` menandai hanya snapshot terbaru pada revisi Item **dan** versi rubrik aktif sebagai `isCurrent`. Pembuat melihat jawaban dan sumber penuh; setelah pergantian owner, owner baru hanya menerima proyeksi yang tidak memuat jawaban dan sumber privat pembuat lama. Daftar memakai cursor dengan limit 20–50.
- `POST /items/{id}/repairs` menerima `expectedItemVersion`, waktu tindakan, ringkasan, hasil, kondisi sesudah, biaya aktual/perkiraan opsional, catatan privat, pilihan berbagi, dan maksimal empat `evidenceTicketIds`. Tiket bukti dibuat melalui `POST /items/{id}/media/tickets` dengan `purpose: REPAIR_EVIDENCE`, lalu diunggah lewat endpoint media yang sama. Bukti tidak masuk galeri Item. Perubahan kondisi memperbarui Item dan menaikkan `itemRevision` secara atomik; owner tetap.
- `POST /repairs/{id}/corrections` dan `/void` hanya untuk pembuat pada tahap ini; keduanya memerlukan alasan, `expectedVersion`, dan header `Idempotency-Key` UUID. Pengulangan kunci dengan payload sama mengembalikan respons pertama; payload berbeda memberi `409 IDEMPOTENCY_CONFLICT`. Void tidak otomatis mengembalikan kondisi Item; Item perlu diperiksa dan dinilai ulang. Jejak revisi disimpan terpisah. Biaya dan identitas pembuat lama tidak dikirim kepada owner baru; foto/catatan rinci hanya jika pembuat membagikannya secara eksplisit.

## Kontrak tahap 3 yang berjalan

- `GET /market` hanya mengembalikan Listing `ACTIVE`; filter: `q`, `category`, `type`, `cityId`, `condition`, `minPriceIdr`, `maxPriceIdr`, `sort`, `cursor`, `limit`. Pencarian mencocokkan judul, deskripsi, kategori, dan kota. Kondisi berasal dari komponen Condition pemilik: `>=75` sangat baik, `50–74` baik, `<50` perlu perhatian. Urutan stabil: `newest` (default), `price_asc`, `price_desc`, atau `score_desc`; urutan harga hanya valid dengan filter `type=RESELL`, Score null berada di akhir.
- `GET /market/{listingId}` mengembalikan proyeksi publik revisi aktif. Foto melalui `GET /market/{listingId}/media/{mediaId}` hanya tersedia selama Listing `ACTIVE` dan media termasuk revisi itu. `RESERVED` memberi halaman status terbatas dan tidak menerima Offer.
- `POST /items/{itemId}/listings` menerima snapshot penuh `type`, `assessmentId`, `expectedItemVersion`, `title`, `description`, `mediaIds`, `cityId`, `conditionDisclosure`, `handoverMethods`, serta field khusus tipe (`askingPriceIdr`, `exchangePreference`, `recipientNote`). `PATCH /listings/{id}` memakai `expectedVersion` dan membentuk revisi baru; `POST /listings/{id}/submit` memeriksa ulang owner, akun, Item, Assessment, keselamatan, foto, serta kelayakan. Route owner yang berjalan: `GET /listings/mine`, `GET /listings/{id}`, dan `POST /listings/{id}/withdraw`.
- Listing `ACTIVE` yang diedit menjadi `PAUSED`; semua Offer revisi lamanya `EXPIRED/LISTING_REVISED`. Perubahan fakta, harga, foto, atau metode serah terima butuh Assessment baru. Koreksi teks copy-only memakai flag `copyOnlyCorrection`; admin tetap memeriksa revisi. Saat ini `REQUEST_CHANGES` dan `REJECT` sama-sama mengubah status Listing ke `REJECTED`; owner memperbaiki dengan revisi baru dan mengirimnya lagi.
- `GET /admin/listing-reviews` membagi antrean biasa dan `SPECIAL_REVIEW`. `POST /admin/listing-reviews/{revisionId}/decide` meminta `expectedVersion`, keputusan, kode/alasan, risiko, serta `Idempotency-Key`. Approve hanya mempublikasikan revisi yang masih cocok dengan Item dan Assessment terkini. Laporan awal dikirim lewat `POST /reports`; `POST /admin/listings/{id}/suspend` dan `/release` memerlukan report, alasan, dan audit; release selalu ke review ulang atau `WITHDRAWN`.
- `POST /listings/{listingId}/offers`, `GET /offers/{id}`, `GET /offers/mine`, serta `POST /offers/{id}/counter`, `/reject`, dan `/withdraw` mendukung Offer Resell/Exchange/Donate. Request Offer membawa `listingRevisionId`, `expectedListingVersion`, `clientRequestId`; harga hanya Resell, Item penawar hanya Exchange. Offer kedaluwarsa tujuh hari; Counteroffer Resell menambah revisi harga dan mengubah pihak yang merespons. Penerimaan Offer tersedia bersama reservasi + Transaction tahap 4.
- `POST /listings/{listingId}/conversations`, `GET /conversations`, `GET /conversations/{id}/messages`, `POST /conversations/{id}/messages`, `POST /conversations/{id}/read`, `GET /conversations/unread-count`, dan `GET /conversations/stream` membatasi data pada peserta. SSE membawa metadata perubahan; UI memuat ulang histori berkala bila stream gagal. `POST` pesan memakai `clientMessageId`; block mencegah pesan baru, report mempertahankan bukti. Report Listing dapat menangguhkan Listing lalu mengirimnya ke review ulang atau menariknya; pelepasan menyelesaikan report terkait.

## Endpoint Admin

| Method dan path | Aturan |
| --- | --- |
| `GET /admin/listing-reviews` / `POST /admin/listing-reviews/{revisionId}/decide` | Filter antrean biasa/khusus; keputusan `APPROVE`, `REQUEST_CHANGES`, `REJECT` dengan alasan, versi kebijakan, dan snapshot. |
| `POST /admin/listings/{id}/suspend` / `POST /admin/listings/{id}/release` | Alasan dan kasus wajib; release menuju review ulang atau penutupan, tidak langsung aktif. |
| `GET /admin/reports` / `POST /admin/reports/{id}/resolve` | Admin; simpan keputusan/audit dan hanya data kasus yang diperlukan. |
| `GET /admin/users` / `POST /admin/users/{id}/suspend` / `POST /admin/users/{id}/release` | Status akun berubah dengan alasan/audit; Transaction aktif ditangani sebagai kasus, bukan diubah diam-diam. |
| `POST /admin/transactions/{id}/resolve-dispute` | `CONTINUE`, `CANCEL`, atau `COMPLETE_AUTHORIZED`; alasan, bukti rujukan, idempotency key; prosedur transfer sama konsistennya dengan penyelesaian normal. |
| `POST /admin/passports/{itemId}/restrict` / `POST /admin/passports/{itemId}/lift-restriction` | `LIMITED`/`HIDDEN`, alasan, kasus, audit; tidak menghapus event. |
| `POST /admin/impact/corrections` / `POST /admin/transactions/{id}/correct` | Kasus dan alasan wajib; delta/event append-only; perubahan owner hanya dengan guard koreksi K06. |
| `GET /admin/rubrics` / `POST /admin/rubrics` / `POST /admin/rubrics/{id}/publish` | Draft dapat diedit; versi terbit immutable dan memiliki contoh uji sebelum publikasi. |
| `GET /admin/audit` / `POST /admin/cases/{id}/chat-access` | Akses chat/bukti privat hanya untuk kasus yang ditugaskan; alasan akses dicatat dan dibatasi. |
| `GET /admin/analytics` | Agregat aktivitas dari ledger/sumber yang jelas; tidak menjumlahkan ringkasan User untuk total platform. |

## Kontrak tahap 4 yang berjalan

- `POST /offers/{id}/accept` memerlukan revisi Offer/Listing dan versi Offer. Pihak pada `respondsById` menerima, termasuk Counteroffer; penerimaan langsung membuat Transaction.
- `GET /me/transactions` memakai cursor, `limit` 1–50, serta filter status. `GET /transactions/{id}` hanya untuk peserta atau admin yang ditugaskan pada kasus terkait. Snapshot privat tidak dikirim.
- `POST /transactions/{id}/confirmations`, `/cancellation-requests`, `/cancellation-requests/{requestId}/respond`, dan `/disputes` memerlukan versi Transaction. Pembatalan menunggu tetap mengizinkan konfirmasi.
- `GET /cases/{id}` menyertakan bukti untuk peserta. `POST /cases/{id}/evidence` menerima `note?`, `messageId?`, dan `ticketIds` maksimal empat; setidaknya satu sumber wajib. `POST /cases/{id}/media/tickets` membuat tiket `CASE_EVIDENCE` sebelum unggah melalui endpoint media.
- `GET /admin/disputes` memakai cursor/filter/limit dan metadata overdue. `GET /admin/disputes/{id}` memberi konteks penuh kepada admin yang ditugaskan. `POST /admin/disputes/{id}/claim` memerlukan versi kasus.
- `POST /admin/cases/{id}/evidence-access` dan `/chat-access` menerima alasan; grant berlaku lima menit. `GET /admin/cases/{id}/evidence` dan `/messages?before=sequence` memeriksa grant yang sesuai. Antrean admin tidak menyertakan catatan/pesan/foto bukti.
- `POST /admin/transactions/{id}/resolve-dispute` menerima versi Transaction, `caseId`, `decision`, alasan, dan `evidenceIds`. Keputusan: `CONTINUE`, `CANCEL`, atau `COMPLETE_AUTHORIZED`. `POST /admin/transactions/{id}/open-case` membuka tindak lanjut overdue dengan versi/alasan.
- `GET /notifications` dan `POST /notifications/{id}/read` hanya untuk pemilik notifikasi. `POST /me/close` mengembalikan `pendingTransactionIds` selain `closedAt`.

Semua POST kritis di atas memakai `Idempotency-Key` UUID kecuali pembuatan tiket media, penandaan notifikasi dibaca, dan penutupan akun yang mengikuti kontrak Auth sebelumnya. OpenAPI mesin versi 1.5.0 menjadi rujukan field runtime. Passport/Impact penuh dan koreksi ditambahkan pada tahap 5.

## Payload penentu state

```json
{
  "listingRevisionId": "uuid",
  "type": "RESELL",
  "priceIdr": 450000,
  "exchangeItemId": null,
  "clientRequestId": "uuid"
}
```

`POST /listings/{id}/offers` mewajibkan `priceIdr` hanya untuk Resell, `exchangeItemId` hanya untuk Exchange, dan keduanya `null` untuk Donate. Server menyimpan revisi Listing yang dilihat dan tidak menerima Offer pada status selain `ACTIVE`.

```json
{
  "offerRevisionId": "uuid",
  "listingRevisionId": "uuid",
  "expectedVersion": 4
}
```

`POST /offers/{id}/accept` mewajibkan `Idempotency-Key`; pada sukses mengembalikan `Transaction` baru dan Listing `RESERVED` dalam satu hasil. Bila dua Offer bersaing, tepat satu berhasil dan yang lain menerima `409 ITEM_RESERVED` atau `STATE_CONFLICT`.

```json
{
  "itemId": "uuid",
  "kind": "RECEIVED",
  "expectedVersion": 2
}
```

`POST /transactions/{id}/confirmations` memeriksa Item dan pihak sesuai snapshot. Respons mengembalikan daftar konfirmasi yang boleh dilihat peserta dan status Transaction terkini. Timeout jaringan harus diikuti `GET` atau retry dengan kunci sama; UI tidak menganggap transfer berhasil sebelum respons server pasti.

## Kode error dan HTTP

| HTTP | Kode | Kapan dipakai |
| ---: | --- | --- |
| 400 | `INVALID_INPUT`, `MEDIA_INVALID` | Tipe data, batas ukuran/jumlah, sumber ekonomi, atau payload tidak valid. |
| 401 | `UNAUTHENTICATED` | Sesi tidak ada/kedaluwarsa. |
| 403 | `FORBIDDEN`, `EMAIL_UNVERIFIED`, `ACCOUNT_SUSPENDED` | Aktor tidak berhak atau belum memenuhi syarat. |
| 404 | `NOT_FOUND` | Data tidak ada **atau tidak boleh diketahui** aktor, termasuk Passport `HIDDEN`. |
| 409 | `STATE_CONFLICT`, `ITEM_RESERVED`, `LISTING_REVISED`, `IDEMPOTENCY_CONFLICT` | Status/versi/lock tidak sesuai. |
| 410 | `OFFER_EXPIRED` | Tenggat Offer sudah lewat. |
| 422 | `STALE_ASSESSMENT`, `ASSESSMENT_INCOMPLETE`, `SAFETY_DATA_MISSING`, `ACTION_NEEDS_DATA`, `ACTION_INELIGIBLE` | Gerbang produk gagal dengan daftar alasan terstruktur. |
| 429 | `RATE_LIMITED` | Batas login, chat, unggah, atau AI. |
| 503 | `DEPENDENCY_UNAVAILABLE` | Layanan eksternal gagal; AI Explainer memakai template fallback bila memungkinkan. |

## Proyeksi dan verifikasi kontrak

`GET /passport/{itemId}` hanya mengirim field publik pada [matriks Passport](07-passport-privacy-draft.md); `GET /items/{id}/passport` menambah hak owner tanpa membuka biaya, kontak, atau chat owner lama. `GET /admin/...` membatasi data kasus sesuai tugas dan audit. Kontrak MVP penuh diuji dengan Guest, owner, owner lama, peserta, User lain, admin moderasi, dan admin kasus setelah semua tahap selesai. OpenAPI mesin versi 1.7.0 mencakup endpoint yang berjalan pada tahap 1–6 melalui `/api/docs` dan `/api/docs-json` di lingkungan lokal, dengan skema input/output, error, dan keamanan. Perubahan perilaku memerlukan revisi docs lebih dulu.


## Implementasi tahap 5 — penguatan kontrak

Endpoint aktual dan matriks pengujian dicatat pada [catatan tahap 5](19-stage5-implementation.md). OpenAPI lokal menjadi sumber skema mesin; mutasi kasus, koreksi, rubrik, kategori, acuan, status pengguna, dan hold memakai `Idempotency-Key` serta versi sumber yang diharapkan. `ListingRevision` menambahkan `itemId`; `Transaction` menambahkan `correctedAt` dan metadata kasus `corrections`.

Antrean laporan dan audit hanya berisi metadata. Admin harus mengambil penugasan dan membuat grant beralasan selama lima menit sebelum membaca isi laporan/bukti. Detail audit REPORT/CORRECTION/DISPUTE juga memerlukan grant lingkup yang cocok. REPORT LISTING dapat membaca audit tindakan yang merujuk `reportId` sama. Report TRANSACTION hanya boleh dibuat peserta transaksi.

Koreksi kepemilikan memakai `caseId`, `expectedCaseVersion`, dan `expectedVersion` transaksi; guard gagal menghasilkan kasus `BLOCKED` tanpa perubahan owner/Impact. Sumber Assessment/Repair dibatalkan atau dipulihkan dengan versi sumber dan kasus koreksi. Visibilitas Passport memakai `scopeType`, `caseId`, versi Passport, alasan, serta `PUBLIC`/`LIMITED`/`HIDDEN`.

Impact mengirim bilangan bulat sebagai string desimal. Periode API memakai UTC `[from,to)`; UI menerjemahkan pilihan 30/90 hari dari Asia/Jakarta. Weight tanpa data tetap `null`, disertai coverage. Penjelasan memakai `source: TEMPLATE`, cache berversi, otorisasi saat setiap baca, dan batas sepuluh permintaan per menit per pengguna.

Acuan ekonomi admin harus dipilih melalui `referenceId`. Server membekukan nominal, sumber, tanggal, dan wilayah dari referensi aktif; input nominal palsu dari klien tidak dipakai. Aktivasi/nonaktivasi referensi memerlukan versi/alasan dan tidak mengubah snapshot lama.

Respons idempotensi yang sudah dibersihkan retensi menjadi tombstone. Retry kunci tersebut mengembalikan `410 RESPONSE_RETAINED_AS_TOMBSTONE` dan tidak menjalankan ulang mutasi. Rubrik terbit dan ledger Passport/Impact dilindungi trigger database terhadap UPDATE/DELETE; retensi hanya membersihkan field privat serta respons/salinannya.


## Tahap 6 — sesi dan pemulihan tindakan (OpenAPI 1.7.0)

| Method/path | Akses dan hasil |
| --- | --- |
| `GET /auth/session` | Metadata opsional, state Guest/Authenticated/Restricted, waktu server; akun dan ID sesi hanya untuk sesi aktif. |
| `POST /auth/reauthenticate` | Kata sandi saat ini; stamp sesi berlaku 15 menit; tujuh percobaan per sesi/15 menit. |
| `GET /me/sessions?cursor=` | Sesi aktif milik sendiri, 30 per halaman; tanpa token/hash atau klaim perangkat/lokasi. |
| `DELETE /me/sessions/{id}` | Cabut sesi sendiri; dapat diulang. Sesi akun lain 404. |
| `POST /me/sessions/revoke-others` | Cabut sesi lain dengan mempertahankan sesi saat ini. |
| `POST /me/actions/status` | `{ operation, key }` dari registry; hanya `COMMITTED`, `PURGED`, `NOT_FOUND`, dan waktu selesai. |
| `PUT /me/profile-photo` | Foto `image/webp` hasil crop persegi 512 × 512; maksimum 1 MiB setelah crop. Mengembalikan profil pemilik. |
| `DELETE /me/profile-photo` | Hapus foto sendiri dan antrekan aset lama untuk retensi. |
| `POST /me/profile-photo/migrate` | Migrasi foto lokal pemilik ke Cloudinary setelah semua key tersedia; kegagalan mempertahankan file lokal. |
| `GET /users/{id}/profile-photo` | Biner lokal privat untuk pemilik atau peserta percakapan. Foto Cloudinary memakai URL bertanda tangan yang hanya dikirim dalam DTO akun/chat. |
| `GET /admin/reports/{id}/metadata` | Metadata laporan tanpa isi privat, untuk navigasi langsung. |
| `GET /admin/correction-cases/{id}/metadata` | Metadata kasus koreksi tanpa bukti, untuk navigasi langsung. |

Sesi maksimal tujuh hari sejak login. Aktivitas dan reautentikasi tidak memperpanjangnya. Login mengganti sesi browser sebelumnya; logout dapat diulang setelah revokasi/expiry. Pencabutan sesi lain, perubahan email, penutupan akun, pembalikan kepemilikan, dan publikasi rubrik memerlukan autentikasi kata sandi dalam 15 menit terakhir; kegagalan `403 REAUTHENTICATION_REQUIRED` terjadi sebelum mutasi. Login dihitung sebagai pembuktian kata sandi.

Antrean laporan, koreksi, dan hold kini memakai cursor 30 baris dengan `meta.nextCursor`. Respons pembacaan privat yang memerlukan grant menyertakan `meta.accessExpiresAt`. Grant kasus lima menit tetap merupakan izin tersendiri. Replay idempotensi memeriksa izin terkini sebelum mengembalikan payload tersimpan; versi mutasi yang sudah berhasil tidak dijalankan ulang. Status pemulihan tidak memuat payload privat dan `NOT_FOUND` tidak membuktikan mutasi gagal.

Seluruh respons API memakai `Cache-Control: no-store`. Sesi dicabut diperiksa kembali dalam transaksi mutasi dan sebelum event SSE dikirim; koneksi SSE diperiksa berkala sepuluh detik. Browser memeriksa sesi setiap navigasi privat, fokus/online/history, dan heartbeat 30 detik pada tab terlihat dengan sesi aktif. Rate limit auth memakai PostgreSQL dan waktu UTC agar berlaku antarproses/restart.

Foto profil menggunakan metadata `ProfilePhoto` terpisah dari media Item. Foto 512 × 512 WebP ditampilkan di akun serta percakapan, tidak di Market atau Passport. Isi `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, dan `CLOUDINARY_API_SECRET` di `apps/api/.env.local`; ketiganya hanya dibaca server dan API secret tidak boleh diekspos ke frontend.
