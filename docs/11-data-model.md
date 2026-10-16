# Model data MVP Valora

**Status:** kontrak data MVP karya INSYFEST 2026. Skema PostgreSQL/Prisma tahap 1–4 sudah berjalan, termasuk Transaction, kasus/bukti/grant, Transfer, event Passport/Impact, dan notifikasi. Proyeksi, agregasi, koreksi ledger, dan operasi admin penuh tetap target tahap 5. Nama kolom fisik dapat berbeda selama aturan produk, privasi, relasi, dan konsistensinya terpenuhi. [PRD](PRD.md), [alur](02-flows-and-states.md), dan [K01–K06](10-mvp-implementation-decisions.md) menjadi sumber aturan. Bukti implementasi ada di [tahap 1](15-stage1-implementation.md), [tahap 2](16-stage2-implementation.md), [tahap 3](17-stage3-implementation.md), dan [tahap 4](18-stage4-implementation.md).

## Tipe dan konvensi

- Semua ID adalah UUID; semua waktu disimpan UTC dan dikirim ISO 8601. Mata uang MVP hanya `IDR`; nominal integer rupiah nonnegatif. Berat nullable dalam gram integer positif, bukan angka tebakan.
- Field `createdAt`, `updatedAt`, dan `version` tersedia pada entitas mutable. Operasi perubahan status memeriksa `version` atau mengunci baris. Event dan revisi yang sudah terbit immutable.
- `deletedAt` berarti soft delete untuk konten yang perlu audit; penghapusan media/data privat mengikuti [K05](10-mvp-implementation-decisions.md#o08--akun-unggahan-dan-retensi-demo). Data pribadi tidak ditaruh dalam payload event publik.
- Semua enum status disimpan eksplisit, bukan disimpulkan dari teks chat. `reasonCode` adalah kode stabil dan `reasonText` menjelaskan keputusan kepada pihak yang berhak.

## Entitas dan field inti

| Entitas | Field inti | Relasi dan batas |
| --- | --- | --- |
| `User` | `id`, `email` unik, `passwordHash`, `emailVerifiedAt?`, `displayName`, `cityId`, `role`, `status`, `closedAt?` | `ACTIVE`/`SUSPENDED`/`CLOSED`; identitas privat. Satu User dapat memiliki banyak Item/Listing/Offer. |
| `ProfilePhoto` | `userId`, `provider`, `storageKey`, `mime`, `bytes`, `createdAt`, `updatedAt` | Satu foto per User; provider `LOCAL` atau `CLOUDINARY`. Metadata foto tidak ikut proyeksi Market/Passport. File lama dibersihkan lewat `StorageDeletion`. |
| `VerificationToken` | `id`, `userId`, `purpose`, `tokenHash`, `expiresAt`, `usedAt?` | Token verifikasi/reset sekali pakai; nilai token mentah tidak disimpan. |
| `Session` | `id`, `userId`, `tokenHash`, `expiresAt`, `revokedAt?`, `lastSeenAt` | Sesi cookie opak; hanya hash token ada di database. Dicabut saat logout, reset kata sandi, atau akun ditutup. |
| `UploadTicket` | `id`, `userId`, `itemId?`, `purpose`, `declaredMime`, `declaredBytes`, `actualMime?`, `actualBytes?`, `storageKey?`, `status`, `expiresAt`, `consumedAt?` | `purpose` membedakan foto Item dan bukti Repair. Tiket awal boleh tanpa Item; tiket bukti harus terkait Item. Konsumsi tiket dan pembuatan entitas dilakukan atomik. |
| `MailOutbox` | `id`, `recipient`, `subject`, `encryptedBody`, `attempts`, `nextAttemptAt`, `sentAt?`, `expiresAt` | Email verifikasi/pemulihan antre dalam transaksi. Isi dienkripsi selama menunggu pengiriman dan dibersihkan setelah terkirim. |
| `UserBlock` | `blockerId`, `blockedId`, `createdAt`, `revokedAt?` | Pasangan aktif unik; mencegah pesan baru tanpa menghapus Conversation, Offer, atau jalur Transaction/Report yang sudah ada. |
| `City` | `id`, `name`, `provinceName`, `active` | Lokasi publik maksimal kota. Alamat rinci tidak ada pada Listing/Passport publik. |
| `Item` | `id`, `currentOwnerId`, `categoryCode`, `subcategoryCode?`, `itemRevision`, `title`, `description`, `estimatedWeightGrams?`, `reservedByTransactionId?`, `archivedAt?` | ID permanen. Tepat satu owner saat ini. Perubahan material menaikkan `itemRevision` dan membuat Assessment sebelumnya tidak terkini. |
| `MediaAsset` | `id`, `uploadedById`, `itemId?`, `repairRecordId?`, `storageKey`, `mime`, `bytes`, `visibility`, `shareWithFutureOwner`, `processedAt?`, `deletedAt?` | `PUBLIC` adalah turunan gambar yang dibersihkan; `PRIVATE` hanya lewat izin API. Lampiran Repair bernilai privat dan tidak dibagi secara default. |
| `RubricVersion` | `id`, `categoryCode`, `subcategoryCode?`, `ruleVersion`, `policyVersion`, `answerConfig`, `safetyConfig`, `effectiveAt`, `publishedById` | Kombinasi kategori/subkategori/versi unik. Versi terbit immutable; Hobi membutuhkan subkategori yang didukung. |
| `Assessment` | `id`, `itemId`, `createdById`, `itemRevision`, `rubricVersionId`, `status`, `answersSnapshot`, `safetySnapshot`, `sourceSnapshot`, `condition?`, `repairability?`, `repairabilityReason?`, `economicValue?`, `reusePotential?`, `score?`, `label?`, `recommendationSnapshot` | `COMPLETE`: empat komponen dan Score ada. `PARTIAL_ECONOMIC`: ekonomi/Score/label null, tiga komponen lain ada. `INCOMPLETE`: field yang belum dapat dihitung null. Snapshot immutable; hanya yang terbaru pada revisi dan versi rubrik aktif menjadi terkini. |
| `RepairRecord` | `id`, `itemId`, `createdById`, `performedAt`, `actionSummary`, `privateNotes?`, `costIdr?`, `costKind?`, `outcome`, `afterCondition`, `status`, `version`, `shareSummaryPublic`, `shareDetailsWithFutureOwner`, `voidReason?` | `VALID`/`VOID`; owner saat pencatatan tetap pembuat. Perubahan kondisi menaikkan revisi Item. Koreksi membuat revisi/event, bukan menghapus jejak. |
| `RepairCorrection` | `id`, `repairId`, `createdById`, `version`, `kind`, `reason`, `beforeState`, `afterState`, `idempotencyKey?`, `payloadHash?`, `responseSnapshot?` | Koreksi/void append-only dan satu kunci idempotensi aktif per pembuat. Kolom kunci nullable hanya untuk kompatibilitas catatan yang dibuat sebelum migrasi tahap 2. |
| `UserBlock` | `id`, `blockerId`, `blockedId`, `createdAt`, `revokedAt?` | Satu row per pasangan; blokir ulang mengaktifkan row yang sama. Check database melarang blokir diri sendiri. |
| `Report` | `id`, `reporterId`, `targetType`, `targetId`, `messageId?`, `reasonCode`, `details`, `status`, `assignedAdminId?`, `resolvedAt?`, `createdAt` | Target dapat Listing, Message, atau User. Antrean admin berisi metadata; endpoint laporan tidak membuka isi percakapan. |
| `AdminAction` | `id`, `adminId`, `reportId?`, `targetType`, `targetId`, `action`, `reason`, `beforeState?`, `afterState?`, `createdAt` | Audit append-only untuk review, penangguhan/pelepasan Listing, dan penanganan laporan. |
| `Listing` | `id`, `itemId`, `ownerId`, `type`, `status`, `currentRevisionId?`, `version`, `publishedAt?`, `closedAt?` | Indeks parsial membatasi satu Listing `ACTIVE`/`RESERVED` per Item. Status mencakup `DRAFT`, `PENDING_REVIEW`, `ACTIVE`, `PAUSED`, `RESERVED`, `CLOSED`, `REJECTED`, `WITHDRAWN`, `SUSPENDED`. |
| `ListingRevision` | `id`, `listingId`, `revisionNo`, `itemId`, `assessmentId`, `itemRevision`, `rubricVersionId`, snapshot judul/deskripsi/kategori/kota/kondisi/aturan, `askingPriceIdr?`, `exchangePreference?`, `recipientNote?`, `handoverMethods`, `copyOnlyCorrection`, `riskFlags`, `createdById` | Snapshot immutable untuk penawar dan moderator. Harga hanya Resell, preferensi pertukaran hanya Exchange, catatan penerima hanya Donate. Foto terkait disimpan lewat `ListingRevisionMedia`. |
| `ListingRevisionMedia` | `revisionId`, `mediaId`, `orderIndex` | Foto Item berurutan per revisi; pasangan revisi/media dan urutannya unik. Foto bukti Repair tidak dapat dipakai untuk Listing. |
| `ModerationReview` | `id`, `listingRevisionId`, `reviewerId`, `decision`, `reasonCode`, `reasonText`, `riskFlags`, `rubricVersionId`, `policyVersion`, `idempotencyKey`, `requestHash`, `createdAt` | Satu revisi dapat memiliki beberapa keputusan saat Listing ditangguhkan dan dilepas ke review ulang. Retry unik per reviewer/kunci idempotensi; indeks revisi/tanggal tidak unik agar jejak lama tetap ada. |
| `Offer` | `id`, `listingId`, `listingRevisionId`, `bidderId`, `exchangeItemId?`, `clientRequestId`, `requestHash`, `status`, `endReason?`, `expiresAt`, `currentRevisionNo`, `version` | `PENDING`, `COUNTERED`, `ACCEPTED`, `REJECTED`, `WITHDRAWN`, `EXPIRED`. Request ID unik untuk retry. Tenggat tujuh hari diatur ulang saat counteroffer; penerimaan formal belum aktif sampai tahap 4. |
| `OfferRevision` | `id`, `offerId`, `revisionNo`, `priceIdr?`, `message?`, `proposedById`, `respondsById`, `expiresAt`, `createdAt` | Append-only; harga hanya untuk Resell. Counteroffer mengubah pihak yang merespons dan memperbarui tenggat. Percakapan tidak mengubah isi Offer. |
| `Conversation` | `id`, `listingId`, `participantAId`, `participantBId`, `messageSequence`, `readSequenceA`, `readSequenceB`, `archivedAt?` | Satu Conversation per Listing/pasangan dengan urutan peserta dinormalisasi. Cursor baca tidak boleh melewati nomor pesan terakhir. |
| `Message` | `id`, `conversationId`, `senderId`, `body`, `clientMessageId`, `sequence`, `sentAt`, `deletedAt?` | Teks saja. Retry unik per `(conversationId, senderId, clientMessageId)`; `sequence` unik dan positif dalam Conversation. |
| `Transaction` | `id`, `listingId`, `offerId` unik, `type`, `sellerOrDonorId`, `buyerOrRecipientId`, `offeredItemId?`, `finalPriceIdr?`, `status`, `acceptedAt`, `targetHandoverAt`, `overdueAt?`, `resolutionOrigin?`, `caseId?` | `AWAITING_HANDOVER`, `ONE_SIDE_CONFIRMED`, `DISPUTED`, `CANCELLED`, `COMPLETED`. Exchange punya dua Item; Resell harga final; Donate/Exchange tidak. |
| `CancellationRequest` | `id`, `transactionId`, `requestedById`, `reason`, `status`, `respondedById?`, `respondedAt?` | `PENDING`, `ACCEPTED`, `REJECTED`; dua persetujuan atau putusan admin diperlukan untuk pembatalan. Tidak menghapus konfirmasi. |
| `DisputeCase` | `id`, `transactionId`, `openedById`, `reason`, `status`, `assignedAdminId?`, `resolution`, `resolvedAt?` | Satu kasus aktif per Transaction; `OPEN`, `IN_REVIEW`, `RESOLVED`. Bukti dan keputusan ditautkan ke Report/AdminAction. |
| `HandoverConfirmation` | `id`, `transactionId`, `actorId`, `itemId`, `kind`, `confirmedAt`, `source`, `idempotencyKey` | `HANDED_OVER`/`RECEIVED`; kombinasi `(transactionId, actorId, itemId, kind)` unik. Konfirmasi sah tidak dihapus setelah sengketa. |
| `OwnershipTransfer` | `id`, `transactionId`, `itemId`, `fromUserId`, `toUserId`, `effectiveAt`, `origin` | `(transactionId, itemId)` unik. Resell/Donate satu row, Exchange dua row dalam satu commit. Koreksi membuat operasi terotorisasi terpisah. |
| `PassportEvent` | `id`, `itemId`, `eventType`, `sourceType`, `sourceId`, `occurredAt`, `recordedAt`, `origin`, `visibility`, `publicPayload`, `correctionOfId?` | Append-only; `(eventType, sourceType, sourceId, itemId)` unik. Payload publik hanya field yang diizinkan [proyeksi](07-passport-privacy-draft.md). |
| `PassportRestriction` | `id`, `itemId`, `level`, `caseId`, `reasonCode`, `appliedById`, `appliedAt`, `liftedById?`, `liftedAt?` | Maksimum satu pembatasan aktif per Item. `LIMITED`/`HIDDEN`; pengangkatan memakai audit baru. |
| `ImpactEvent` | `id`, `metric`, `sourceType`, `sourceId`, `itemId?`, `attributedUserId?`, `delta`, `unit`, `occurredAt`, `recordedAt`, `correctionOfId?`, `reasonCode?` | Append-only; kunci sumber unik mencakup jenis peristiwa/koreksi. Agregat platform dan User dihitung dari ledger; tidak ada counter manual. |
| `Report` | `id`, `reporterId`, `targetType`, `targetId`, `status`, `reason`, `openedAt`, `resolvedAt?`, `assignedAdminId?` | `OPEN`, `IN_REVIEW`, `RESOLVED`, `DISMISSED`; status dan keputusan diaudit. |
| `AdminAction` | `id`, `adminId`, `caseId?`, `targetType`, `targetId`, `action`, `reason`, `at`, `beforeSnapshot?`, `afterSnapshot?` | Tidak dihapus. Akses chat/bukti privat memerlukan kasus, alasan, dan log akses terpisah atau aksi ini. |
| `CaseEvidence` | `id`, `caseId`, `submittedById`, `mediaId?`, `messageId?`, `note?`, `createdAt`, `retentionHoldUntil?` | Bukti hanya terlihat peserta dan admin kasus sesuai tugas; media privat tidak muncul di Passport publik. |
| `InAppNotification` | `id`, `userId`, `eventKey`, `type`, `payload`, `createdAt`, `readAt?` | `eventKey` unik per penerima agar pengingat hari 7/12 tidak ganda. Payload tidak memuat alamat rinci. |
| `IdempotencyRequest` | `actorId`, `key`, `operation`, `requestHash`, `responseCode`, `responseBody`, `completedAt` | `(actorId, key, operation)` unik. Pengulangan dengan hash sama mengembalikan hasil sama; hash berbeda memberi `IDEMPOTENCY_CONFLICT`. |

## Kendala dan indeks yang perlu diterapkan di database

1. Satu Listing `ACTIVE`/`RESERVED` per Item melalui indeks unik parsial pada `Listing.itemId`. `Item.reservedByTransactionId` hanya dapat menunjuk satu Transaction; semua item terkait dikunci menurut urutan ID tetap agar penerimaan Offer bersamaan tidak menghasilkan dua pemenang.
2. `Listing.currentRevisionId` harus menunjuk revisi milik Listing yang sama. Offer dan Review menunjuk revisi yang sudah ada dan immutable. Pada tahap 3, keputusan review ulang boleh menambah baris audit untuk revisi sama; idempotensi ditentukan oleh pasangan reviewer/kunci.
3. `Offer.expiresAt` diisi tujuh hari setelah pembuatan atau Counteroffer terakhir; endpoint baca/tindakan membandingkannya dengan waktu server. Worker expiry terjadwal belum diterapkan.
4. Konfirmasi hanya untuk pihak dan Item yang ditetapkan Transaction. Dalam Exchange empat pasangan aksi wajib dan unik; Resell/Donate dua pasangan wajib. Konfirmasi terakhir boleh memicu penyelesaian hanya jika tidak `DISPUTED`.
5. `Transaction.COMPLETED`, status Listing `CLOSED`, dua perubahan owner Exchange (satu untuk jalur lain), Transfer, Passport, dan Impact commit bersama. Jika gagal, seluruhnya rollback. `IdempotencyRequest` dan kunci sumber event mencegah efek ganda.
6. `Items Revalued` unik per Item secara historis. Koreksi ledger boleh membalik agregat, tetapi Assessment ulang biasa tidak membuat kredit baru. Atribusi transfer memakai owner yang menyerahkan dalam snapshot Transaction.
7. Query publik hanya mengembalikan Listing `ACTIVE` dan proyeksi Passport yang lolos aturan D14/K04. `RESERVED` dapat dilihat dari tautan historis/Passport sesuai hak, tetapi tidak muncul sebagai hasil penawaran aktif.

## Transaksi basis data dan batas kegagalan

| Operasi | Baris yang dikunci | Hasil atomik |
| --- | --- | --- |
| Terima Offer | Listing, Item Listing, Item penawar Exchange bila ada, Offer/revisi | Validasi owner/status/versi; satu Offer `ACCEPTED`, Listing `RESERVED`, Item terkait reserved, satu Transaction. |
| Batalkan Transaction | Transaction, Listing, Item terkait | Status `CANCELLED`, lepas semua reservasi, validasi ulang Listing ke `ACTIVE`/`PAUSED`/`SUSPENDED`; tidak ada Transfer/Impact. |
| Selesaikan Transaction | Transaction, Listing, semua Item terkait, konfirmasi | Semua owner/Transfer/Passport/Impact/status selesai bersama atau tidak satu pun. |
| Koreksi terotorisasi | Kasus, Transaction asal, Item terkini, event sumber | Catatan koreksi dan delta konsisten; owner berubah hanya bila guard koreksi terpenuhi. |

Operasi eksternal seperti email, AI, dan media tidak berada dalam transaksi PostgreSQL. Gunakan event/outbox atau pekerjaan yang dapat dicoba ulang dengan kunci unik; kegagalannya tidak boleh membuat ownership setengah berpindah.


## Tambahan tahap 6

- `Session.reauthenticatedAt`: stamp pembuktian kata sandi per sesi; migrasi memakai `createdAt` untuk sesi lama.
- `AuthRateBucket`: kunci hash SHA-256, jumlah percobaan, batas waktu UTC, indeks expiry. Tidak menyimpan password/email/token mentah.
- `StorageDeletion.kind`: `MEDIA`, `MAIL`, `PHOTO_LOCAL`, atau `PHOTO_CLOUD`; antrean penghapusan durable merutekan aset ke penyimpanan yang sesuai. Artefak email lokal kedaluwarsa setelah masa simpan 24 jam ikut dibersihkan.
- Transaksi domain memakai gate advisory PostgreSQL bersama dan lock User/resource; pemeriksaan sesi diulang sebelum mutasi. Gate ini sengaja membatasi throughput penulisan untuk target demo lokal.
