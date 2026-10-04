# Verifikasi koreksi kanvas publik

Tanggal: 3 Oktober 2026. Cakupan: Beranda `/`, Cara Kerja `/cara-kerja`, Impact publik `/impact`, serta header/footer bersama.

## Persetujuan dan implementasi

Pengguna menolak halaman yang mengambang dalam kontainer rounded besar dan memilih **Tepi tipis**. Kanvas sekarang putih selebar viewport dengan tinggi minimum `100dvh`, tanpa margin, border, atau radius luar. Gutter konten adalah 24 px di desktop/tablet dan 16 px hingga lebar 639 px. Hero, foto, kartu, dan kontrol mempertahankan radius komponennya.

Perubahan kode koreksi terbatas pada `src/app/public.css` dan atribut Image `sizes` di `src/app/page.tsx` serta `src/app/cara-kerja/page.tsx`. Alur, konten, aset, dan sumber data publik dipertahankan.

Pemeriksaan pertama menunjukkan kelas `container` Tailwind masih menerapkan batas lebar pada desktop dan layar lebar. Deklarasi `.valora-surface .container { max-width: none; }` menghapus batas tersebut. `inspection-before-max-width-fix.json` adalah diagnosis historis; bukti final adalah [inspection.json](inspection.json).

## Pemeriksaan kode dan build

| Pemeriksaan | Hasil |
| --- | --- |
| `pnpm --filter @valora/web run typecheck` | Lulus. |
| `pnpm --filter @valora/web run lint` | Lulus. |
| Build produksi dengan `NEXT_BUILD_DIRECTORY=.next-public-build` | Lulus; 45 route. |
| Restorasi `tsconfig.json` dan `next-env.d.ts` yang ditulis ulang Next saat build terpisah | Hash keduanya cocok dengan backup sebelum koreksi. |

Build dan browser memakai direktori produksi terpisah serta port 3004. Server pengembangan pengguna di port 3000 dan API di port 4000 dipertahankan.

## Browser

Suite yang sudah ada: `apps/web/tests/public-ui.spec.mjs`. Perintah dari root proyek:

```powershell
pnpm --filter @valora/web run test:e2e --config ../../.local/redesign-phase1/playwright-flat.config.mjs
```

Hasil final setelah koreksi lebar baca Cara Kerja: **20 kasus lulus** dalam 20,7 detik, terdiri dari lima skenario pada empat viewport. Skenario mencakup:

- Filter kategori, tautan ke Market dengan kategori, detail Listing, dan CTA tamu.
- Jenis Listing, harga, judul panjang, foto hilang, dan foto gagal dimuat.
- Kegagalan API, coba lagi, dan data kosong.
- Lima metrik Impact, nilai null, rupiah besar, periode, dan sumber.
- CTA pengguna yang masuk, skip link, menu mobile, Escape, dan pengembalian fokus.

Data kasus ekstrem diintersep oleh browser; tidak ada akun atau transaksi nyata yang dibuat.

## Capture final

Semua capture diambil dari puncak dokumen setelah konten dan gambar selesai dimuat. Mode reduced motion serta scroll instan digunakan untuk menghentikan transisi scroll saat pengambilan bukti. Capture full page dan empat capture layar awal Beranda dibuka untuk memastikan nama file, route, dan kontennya sesuai.

| Viewport | Gutter kiri/kanan | Grid Listing | Beranda | Cara Kerja | Impact |
| --- | --- | --- | --- | --- | --- |
| 1440 × 1000 | 24 px | 3 kolom | `home-desktop.png` | `how-desktop.png` | `impact-desktop.png` |
| 768 × 1024 | 24 px | 2 kolom | `home-tablet.png` | `how-tablet.png` | `impact-tablet.png` |
| 390 × 844 | 16 px | 1 kolom | `home-mobile.png` | `how-mobile.png` | `impact-mobile.png` |
| 1920 × 1080 | 24 px | 3 kolom | `home-wide.png` | `how-wide.png` | `impact-wide.png` |

Seluruh 12 capture memiliki HTTP 200, `validCanvas: true`, tidak ada error JavaScript, tidak ada gambar rusak, dan lebar dokumen sama dengan viewport. Header, main, footer, dan hero Beranda mengikuti gutter yang sama. CTA hero Beranda berada di layar awal pada keempat ukuran.

Capture menggunakan data API yang tersedia. Foto katalog demo arts/crafts yang berulang disertai disclosure simulasi dan bukan bukti foto unit individual. Aset editorial tidak diubah dalam koreksi ini.

## Review

Pemeriksa mekanis layout menjalankan detector sekali pada tiga file kode yang berubah: exit 0 dan JSON `[]`. Scan tersebut mendahului deklarasi `max-width: none` pada container dan koreksi lebar baca 70ch dari reviewer; perubahan berikutnya dikonfirmasi melalui sumber dan bukti render. Tidak ada detector kedua.

Review baru meminta satu koreksi lebar baca Cara Kerja pada layar lebar. `.how-steps p`, `.how-steps small`, dan `.passport-explanation p` kini memiliki `max-width: 70ch`. Kanvas serta kolom halaman tetap mengikuti lebar layar dan gutter yang disetujui. Build produksi dan seluruh 20 kasus browser diulang setelah perubahan ini; capture final memakai kode yang sudah dikoreksi. Properti `prose` pada `inspection.json` menyimpan lebar render dan batas baca tiap paragraf. Tidak ada perubahan aset.

[Review visual baru](../finish-review-flat.md) menilai ketiga halaman pada keempat viewport dengan referensi pengguna dan aturan kanvas yang telah disetujui. Review fase pertama sebelum koreksi disimpan sebagai catatan historis.
