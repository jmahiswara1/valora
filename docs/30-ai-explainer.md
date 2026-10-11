# AI Explainer penilaian

Perluasan setelah MVP · PRD 1.25 · OpenAPI 1.15.0.

## Pengalaman pengguna

Pada detail penilaian `/app/barang/[id]/penilaian/[assessmentId]`, tombol **Jelaskan hasil penilaian** memulai satu permintaan manual. Penjelasan membedakan sumber AI dan rubrik, menjelaskan komponen, keterbatasan, empat pilihan Repair/Resell/Exchange/Donate, serta langkah berikutnya. Penjelasan historis tetap ditandai. AI tidak menghitung ulang Score, menentukan harga, mengubah kelayakan, atau memindahkan kepemilikan.

Tidak ada generasi otomatis ketika halaman mendapat fokus atau jaringan terhubung kembali. Status proses, hasil tersimpan, kesalahan sementara, kuota dan waktu mencoba ulang tampil di panel yang sama. Kesalahan sementara mempertahankan hasil sebelumnya; akses ditolak atau snapshot berubah menyembunyikannya. Penjelasan dirender sebagai teks React biasa, tanpa HTML/Markdown aktif.

Hasil pertama tampil ringkas: sumber, ringkasan, pemberitahuan, catatan batas penggunaan dan tombol mencoba ulang tetap terlihat. Kontrol **Lihat penjelasan lengkap** membuka komponen pendukung, batas penilaian, alasan setiap pilihan dan langkah berikutnya; **Ringkas penjelasan** menutup rincian tersebut. Buka/tutup hanya mengubah tampilan hasil yang tersedia, tanpa permintaan AI atau pemakaian kuota. Pilihan buka/tutup dipertahankan saat mencoba ulang penilaian yang sama; penilaian lain dimulai tertutup. Pemisah bawah menandai akhir penjelasan sebelum bagian **Pilihan tindakan**.

## Konfigurasi backend

Isi hanya di `apps/api/.env.local` yang diabaikan Git, lalu mulai ulang backend:

```dotenv
AI_EXPLAINER_ENABLED=true
AI_BASE_URL=http://localhost:20128/v1
AI_MODEL=ag/gemini-3.8-flash-high
AI_API_KEY=<kunci lengkap 9router>
AI_USER_DAILY_LIMIT=20
AI_APP_DAILY_LIMIT=200
AI_TIMEOUT_MS=60000
```

Contoh yang dapat dikomit berada di `.env.example`, dengan AI nonaktif dan kunci kosong. Kunci, endpoint internal, dan kredensial tidak dikirim ke browser. Kunci bertanda `sk-...` belum lengkap. Gateway harus dapat dijangkau dari proses backend; pada container/mesin terpisah, `localhost` merujuk mesin backend tersebut. Gateway lokal dapat meneruskan permintaan ke penyedia eksternal: bukan jaminan inferensi di perangkat.

Adapter memakai [API kompatibel OpenAI 9router](https://github.com/decolua/9router/blob/main/gitbook/content/en/integration/other-tools.md): `POST /v1/chat/completions`, Bearer key, model persis sesuai konfigurasi, `stream: false`, dan permintaan JSON melalui prompt. Tidak mengandalkan `response_format` untuk memaksakan schema. Tidak ada percobaan ulang upstream otomatis.

## Privasi dan validasi

Payload disusun dari whitelist: kode kategori/rubrik, status, komponen dan Score yang memang ada, label, current/historical, kode data yang kurang, flag keselamatan, keputusan dan kode alasan aturan. Identitas, ID barang/penilaian, judul/deskripsi, teks konteks, catatan/sumber ekonomi, alamat, foto dan chat tidak dikirim. Nilai rupiah mentah tidak dibutuhkan untuk penjelasan ini.

Respons harus lengkap, tidak melebihi 128 KiB, dan selesai dengan `finish_reason: stop`. Mirror fakta, empat status tindakan dan kode alasan harus persis sesuai input. Daftar dan panjang prosa dibatasi; prosa kualitatif tidak boleh memuat angka, nilai uang, URL, HTML atau klaim verifikasi/jaminan. Angka tetap ditampilkan dari hasil Valora. Alasan dan keterbatasan dari aturan selalu dipertahankan bersama teks AI, termasuk penilaian parsial, historis dan keselamatan. Validasi ini mengurangi keluaran keliru; prosa AI tetap penjelasan pendukung, bukan pemeriksaan fisik atau keputusan domain.

Prompt dan respons mentah tidak disimpan atau dicatat. Cache menyimpan hanya output yang lolos schema, atau template fallback. Logging tidak mencatat key/header/body upstream.

## Akses dan konkurensi

`POST /api/v1/assessments/:id/explain` membutuhkan sesi aktif, akun aktif, CSRF, serta akses sebagai pembuat penilaian atau pemilik barang saat ini. Otorisasi tetap diperiksa untuk hasil cache dan permintaan yang menunggu generasi lain.

Cache valid AI berlaku 24 jam; namespace `exp2` terpisah dari cache template lama. Key hash mencakup penilaian/versi, proyeksi pembuat/pemilik, kepemilikan/revisi, snapshot terstruktur, current/historical, endpoint, model, prompt dan versi template. TTL tidak diperpanjang oleh cache hit. Perubahan state diperiksa ulang setelah panggilan upstream, sebelum cache dan respons diterbitkan; perubahan menghasilkan `409 STATE_CONFLICT` tanpa menyimpan hasil lama.

Lease database memadukan generasi untuk key sama antarproses, membatasi maksimal dua panggilan global dan kedaluwarsa setelah 90 detik jika proses mati. Token lease mencegah worker lama menghapus lease pengganti. Panggilan upstream tidak berada dalam transaksi database; batas waktunya 60 detik. Permintaan yang bergabung menunggu maksimal 70 detik, dengan pemeriksaan sesi dan snapshot. Browser memberi batas 75 detik khusus endpoint ini, sementara permintaan lain tetap 15 detik.

Kuota tersimpan dalam bucket database terpisah: 20 panggilan per pengguna/hari dan 200 global/hari, reset pukul 00.00 WIB. Hanya reservasi generasi outbound yang menghabiskan kuota, termasuk kegagalan setelah reservasi; cache hit, join, layanan sibuk dan konfigurasi kosong tidak menghabiskannya. Kedua kuota dicek dan direservasi atomik di gate transaksi yang sama. Batas endpoint sepuluh permintaan per menit per pengguna berlaku juga pada cache hit dan tetap lintas proses. Cleanup berkala membuang cache/lease/bucket kedaluwarsa.

## Kontrak fallback

Sejak analisis foto pada OpenAPI 1.16.0, bucket harian dan batas dua generasi bersamaan dipakai bersama oleh AI Explainer dan analisis foto. Namespace bucket Explainer tetap dipertahankan agar penggunaan hari berjalan tidak direset. Rincian ada pada [Analisis Foto AI](31-ai-photo-analysis.md).

Output lama tetap valid: `source`, `templateVersion`, `assessmentId`, `historical`, `summary`, `strengths`, `limitations`, `actions`, `nextSteps`. `source` kini `AI | TEMPLATE`; metadata opsional baru: `promptVersion`, `generatedAt`, `expiresAt`, `cached`, `fallbackReason`, `retryAt`.

| Alasan | Pemulihan |
| --- | --- |
| DISABLED / NOT_CONFIGURED | Template langsung; konfigurasi backend diperlukan |
| USER_QUOTA / APP_QUOTA | Template; mencoba ulang setelah reset WIB |
| BUSY | Template; mencoba ulang setelah 30 detik |
| TIMEOUT / UPSTREAM_UNAVAILABLE / INVALID_OUTPUT | Template dengan cooldown cache 30 detik; tanpa retry otomatis |

Fallback kuota dan sibuk tidak dicache lintas pengguna. Kegagalan upstream pada snapshot yang sama dicache sebentar untuk mencegah panggilan berulang. Data yang belum lengkap tidak dipaksa menjadi Score total.

## Migrasi dan pengujian

Migrasi additive `20261010010000_ai_explainer` menambahkan metadata expiry/provider ke `ExplanationCache` dan tabel `ExplanationLease`; `AuthRateBucket` yang ada digunakan dengan namespace hash khusus. Skema penilaian, rumus, transaksi dan ownership tidak berubah.

Pengujian provider menggunakan mock HTTP untuk privacy, mirror angka/status/alasan, batas output, timeout dan respons terpotong. Smoke API memakai database test dan dua proses worker untuk deduplikasi, kuota atomik, TTL, WIB, concurrency, cooldown, sesi dicabut dan snapshot/kepemilikan berubah. Browser menguji manual generation, loading di atas timeout umum, fallback, quota, cache, error, historical/partial, teks aman serta lebar desktop/mobile/320px. Suite regresi standar menonaktifkan AI agar tidak memakai kunci atau layanan nyata.

Koneksi nyata ke 9router diperiksa terpisah dengan fakta sintetis. Hasil koneksi bukan jaminan model/provider akan selalu tersedia; template tetap jalur pemulihannya.
