# Perbaikan P3: validasi cursor Market

Temuan A06 diperbaiki dengan validasi runtime cursor sebelum query database. Payload JSON tidak lagi hanya di-cast menjadi tipe TypeScript.

Cursor harus berupa satu string Base64url kanonis, tidak kosong, dan maksimal 1024 karakter. UUID, tanggal ISO, dan jenis pengurutan harus valid. Payload diperiksa berdasarkan varian pengurutan dan menolak field tambahan:

| Pengurutan | Batas pagination |
| --- | --- |
| `newest` | UUID dan tanggal |
| `price_asc`, `price_desc` | UUID, tanggal, dan harga integer 0 sampai `Number.MAX_SAFE_INTEGER` |
| `score_desc` | UUID, tanggal, dan Score integer 0–100 atau `null` |

Jenis pengurutan pada cursor harus sama dengan query. Harga atau Score yang diperlukan tidak boleh hilang; nilainya tidak dikonversi dari string. Seluruh kegagalan decode atau validasi menghasilkan HTTP 400 dengan kode `INVALID_INPUT`.

Halaman pertama menggunakan query tanpa parameter `cursor`. Halaman berikutnya menggunakan `meta.nextCursor` dari respons server. Format cursor yang dihasilkan server tetap kompatibel, dan tidak ada migrasi database.

## Verifikasi

- Build API dan lint API lulus.
- Seluruh 75 unit test lulus, termasuk 36 regresi cursor baru yang memeriksa input rusak, nilai batas, dan penolakan sebelum query database.
- Smoke Market melalui HTTP lulus untuk pagination keempat pengurutan, cursor yang dimodifikasi, encoding rusak, payload null, cursor berlebihan, serta parameter cursor berulang. Respons invalid diperiksa sebagai 400 `INVALID_INPUT`.

Bukti HTTP lokal berada di `.local/p3-market-recheck.log`.
