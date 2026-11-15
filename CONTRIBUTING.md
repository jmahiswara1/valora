# Kontribusi Valora

Ikuti setup pada [README](README.md). Jalankan seluruh perintah workspace dari root project.

## Organisasi source

- `apps/web/src/app`: rute; `features`: perilaku per fitur; `components`: komponen bersama; `styles`: stylesheet.
- `apps/api/src/modules`: domain API; `infrastructure`: database, penyimpanan, email, dan jobs; `shared`: utilitas lintas modul; `openapi`: kontrak Swagger.
- `apps/api/prisma`: schema, migrasi, dan data referensi. Tambahkan migrasi untuk perubahan database.
- `packages/contracts/src`: tipe dan validasi yang dipakai web/API.
- `apps/web/tests` dan skrip smoke API: pengujian; fixture yang diperlukan test harus berada dalam folder pengujian yang dilacak Git.

## Pemeriksaan dan commit

Jalankan `pnpm typecheck`, `pnpm lint`, dan pengujian terkait perubahan. Jalankan pengujian API dan E2E bergantian karena keduanya memakai database test dan port API yang sama.

Gunakan pesan commit `type: short description` dalam bahasa Inggris, misalnya `fix: validate handover schedule` atau `docs: clarify local setup`.

Commit source, aset aplikasi, konfigurasi contoh, lockfile, migrasi, dan pengujian. Kredensial, upload, hasil build, cache, dokumentasi internal, serta artefak alat pengembangan tetap lokal sesuai `.gitignore`.

Sebelum commit, periksa `git status --short`, `git diff --cached --stat`, dan `git diff --cached --check`. File teks memakai LF sesuai `.gitattributes`.
