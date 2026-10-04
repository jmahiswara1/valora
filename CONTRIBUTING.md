# Kontribusi Valora

## Pesan commit

Commit pertama repository harus persis:

```text
initial commit
```

Setelah commit pertama, gunakan format berikut tanpa scope:

```text
type: short desc
```

Deskripsi singkat, jelas, dan memakai bahasa Inggris. Gunakan huruf kecil untuk
type dan jangan tambahkan scope dalam tanda kurung.

| Type | Penggunaan |
| --- | --- |
| `feat` | Fitur baru |
| `fix` | Perbaikan bug |
| `docs` | Dokumentasi |
| `style` | Format kode tanpa perubahan perilaku |
| `refactor` | Perapihan kode tanpa mengubah perilaku |
| `perf` | Peningkatan performa |
| `test` | Penambahan atau perbaikan test |
| `build` | Build, dependency, dan packaging |
| `ci` | Konfigurasi CI |
| `chore` | Pemeliharaan lainnya |
| `revert` | Membatalkan perubahan sebelumnya |

Contoh:

```text
feat: add market filters
fix: center confirmation modal
docs: update setup guide
refactor: organize feature modules
```

## File dalam repository

Commit source, konfigurasi, `pnpm-lock.yaml`, schema dan migrasi Prisma, seed
sintetis, aset aplikasi, serta dokumentasi. `.env.example` hanya memuat
placeholder; kredensial sebenarnya tetap di `.env.local`.

Dependency, hasil build, cache, `.local`, upload pengguna, kredensial demo, dan
screenshot review tetap lokal sesuai `.gitignore`. Laporan review teks dan
fixture sintetis tetap disertakan; lihat
[catatan review](apps/web/.impeccable/review/README.md).

Line ending file teks dinormalisasi ke LF melalui `.gitattributes`. Pemisah baris
Markdown yang memakai dua spasi di akhir baris tetap diperbolehkan.

Sebelum commit, periksa `git status --short`, `git diff --cached --stat`, dan
`git diff --cached --check`. Pastikan staged files tidak memuat kredensial,
token, data pengguna, atau artefak lokal.
