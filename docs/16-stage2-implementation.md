# Implementasi tahap 2 — Nilai Item

**Status:** selesai untuk baseline MVP lokal. Rubrik berversi, Assessment dan Score deterministik, rekomendasi, Repair, riwayat, serta layar pengguna telah diterapkan dan diverifikasi melalui smoke tahap 1–2. Aturan produk tetap mengikuti [PRD](../PRD.md), [domain](03-domain-and-scoring.md), [rubrik](06-category-rubric-draft.md), dan [kontrak API](12-api-contract.md).

## Yang berjalan

- Seed menerbitkan sembilan rubrik awal (`score-v1`, `policy-v1`, `recommendation-v1`) dengan enam indikator, lima pilihan berteks untuk setiap indikator, konteks yang relevan, dan tiga deklarasi keselamatan per target. Rubrik terbit disimpan sebagai versi immutable; seed ulang melewati kombinasi versi yang sudah ada.
- Assessment menyimpan jawaban, sumber tiga angka ekonomi beserta pelapor, hasil empat komponen, Score nullable, penanda keselamatan, alasan, dan rekomendasi sebagai snapshot. Status sah adalah `INCOMPLETE`, `PARTIAL_ECONOMIC`, dan `COMPLETE`. Hanya Assessment terakhir pada revisi Item dan rubrik aktif yang bertanda terkini. Revisi lama tetap dapat dibaca sebagai riwayat.
- Perhitungan memakai indikator 0/25/50/75/100, pembulatan `.5` ke atas, bobot 30/25/25/20, dan rasio ekonomi dengan perbandingan integer. `NOT_NEEDED` menghasilkan Repairability 100 dan biaya perbaikan Rp0 bersumber jelas. Kondisi terlarang dapat tetap menghasilkan Score, tetapi memblokir rekomendasi transfer. `TIDAK_TAHU` pada keselamatan menghasilkan `INCOMPLETE`.
- Perubahan kategori, subkategori, deskripsi, ringkasan fungsi/kondisi/kelengkapan/masalah, serta foto Item menaikkan `itemRevision`. Edit judul, tahun, harga awal, dan berat saja tidak mengusangkan penilaian. Draft Hobi dapat disimpan tanpa subkategori; Assessment menunggu subkategori yang didukung.
- Repair mencatat tindakan, waktu, hasil, biaya aktual/perkiraan, kondisi sesudahnya, catatan privat, hingga empat foto bukti, serta pilihan berbagi. Kondisi yang berubah memperbarui Item dan revisinya secara atomik. Koreksi dan void memakai alasan, versi, jejak append-only, dan `Idempotency-Key`; void tidak mengembalikan kondisi Item secara otomatis. Foto bukti tidak masuk galeri Item dan URL singkatnya diperiksa lagi saat dibuka.
- Halaman Item menghubungkan formulir, hasil, dan riwayat Assessment serta form/riwayat Repair. UI menampilkan Score total hanya untuk `COMPLETE`, data yang kurang, sumber dan versi, alasan tiap jalur, serta penanda historis. Komposisi mengacu pada Pencil U05–U06 dengan token `v1`; kanvas Pencil tidak diedit. Tombol AI Explainer pada contoh Pencil menunggu tahap 5.

## Kontrak dan privasi

Endpoint tahap 2 terdapat pada [kontrak API](12-api-contract.md#kontrak-tahap-2-yang-berjalan) dan OpenAPI lokal `/api/docs-json`. Semua mutasi memakai sesi dan CSRF; Assessment/Repair hanya dapat dibuat pada Item milik sendiri dengan versi yang cocok. Pembuat melihat detail historisnya. Proyeksi untuk owner berikutnya menahan jawaban/sumber privat Assessment, identitas pembuat Repair lama, biaya, catatan, dan bukti yang belum sengaja dibagikan. User lain mendapat `404`.

Belum ada acuan harga pembanding admin yang bersumber; input `ADMIN_CATEGORY_REFERENCE` ditolak. Pemilik dapat memberi referensi atau estimasi sendiri dengan uraian dan tanggal. Rekomendasi `ELIGIBLE` adalah hasil aturan awal dan belum membuka Listing pada tahap ini. Market, moderasi, Transaction, Passport, Impact, dan AI Explainer mengikuti tahap 3–5.

## Menjalankan dan memeriksa

Pada lingkungan lokal yang sudah disiapkan, jalankan `pnpm db:deploy` dan `pnpm db:seed`, lalu `pnpm dev`. Migrasi tahap 2 bersifat tambahan dan mempertahankan Item tahap 1 tanpa Assessment. Hasil yang diamati:

- `pnpm test`: enam uji rumus dan smoke API tahap 1–2 lulus, termasuk contoh keyboard Score 72, batas rasio, keselamatan, privasi bukti, revisi Item, koreksi/void, dan retry idempoten.
- `pnpm typecheck`, `pnpm lint`, dan `pnpm build` lulus.
- Chrome headless memeriksa halaman hasil, formulir, dan Repair pada lebar 390 px serta 1440 px tanpa scroll horizontal; simpan Assessment belum lengkap dan Repair melalui UI berhasil. Screenshot pemeriksaan berada di `.local/` dan diabaikan Git.
