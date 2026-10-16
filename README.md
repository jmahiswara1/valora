# Valora

*Keep Things Valuable*

Platform sirkular untuk merawat, menilai, menjual, menukar, dan mendonasikan barang dengan Passport riwayat barang, pencatatan Impact, dan bantuan AI.

## Menjalankan lokal

Siapkan **Node.js 24.15+**, **pnpm 11.28.0**, dan **PostgreSQL** di `127.0.0.1:5432`.

Untuk instalasi awal, jalankan dari root repository:

```powershell
pnpm install
node apps/api/scripts/database/setup.mjs
pnpm db:deploy
pnpm db:seed
pnpm dev
```

Skrip setup meminta password admin PostgreSQL dan membuat `apps/api/.env.local`. Rincian konfigurasi dan akun demo ada di [panduan pengembangan lokal](docs/development.md).

| Layanan | Alamat lokal |
| --- | --- |
| Web | http://localhost:3000 |
| API | http://127.0.0.1:4000/api/v1 |
| Swagger | http://127.0.0.1:4000/api/docs |

## Perintah utama

```powershell
pnpm typecheck
pnpm lint
pnpm build
```

## Dokumentasi

- [PRD](docs/PRD.md) — tujuan dan aturan produk.
- [Peta dokumentasi](docs/README.md) — spesifikasi dan catatan implementasi fitur.
- [Pengembangan lokal](docs/development.md) — setup, konfigurasi, pemeriksaan, dan demo.
- [Struktur source](docs/22-file-organization.md) — organisasi dan penamaan file.
- [Kontribusi](CONTRIBUTING.md) — format commit dan aturan repository.
