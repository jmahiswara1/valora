# Footer review

Footer publik tampil sebagai kartu hijau Forest dengan sudut membulat. Kartu memakai gutter luar 24px pada desktop dan 16px pada ponsel; radius 24px pada desktop dan 18px pada ponsel. Inset konten disamakan dengan card “Mulai dari satu barang.”: 40px desktop, 32px tablet, dan 28px ponsel.

## Pemeriksaan tampilan

Tangkapan layar mencakup Beranda (`/`) dan Market (`/market`) pada lebar 1440px, 768px, 390px, dan 320px. Semua delapan hasil tersedia di folder ini.

- Lebar dokumen sama dengan lebar viewport pada kedelapan tangkapan layar; tidak ada overflow horizontal.
- Logo Valora lebih besar dan berada di sisi kiri bersama empat ikon sosial visual: Instagram, TikTok, Gmail, dan YouTube.
- Tautan kanan tersusun dalam grup Jelajahi (Market, Cara kerja, Impact) dan Akun (Daftar, Masuk).
- Kalimat “Jaga nilai barang, mulai dari yang sudah kamu miliki.” sudah tidak ditampilkan.
- Ikon sosial belum memiliki tautan, sesuai pilihan pengguna.

## Pemeriksaan source

- `pnpm --filter @valora/web run typecheck` — lulus.
- `pnpm --filter @valora/web run lint` — lulus.

`inspection.json` menyimpan ukuran viewport, dimensi footer, inset konten, padding card pembanding, tautan, label ikon, dan status kalimat untuk kedelapan tangkapan layar.
