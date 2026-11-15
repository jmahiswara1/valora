# Pembayaran QRIS demo

Detail transaksi menampilkan pembayaran QRIS demo untuk Resell dan tambahan uang Exchange. Donasi serta pertukaran tanpa tambahan uang tidak memiliki langkah pembayaran. Nominal, pembayar, dan penerima diturunkan dari kesepakatan di server. Gambar QRIS yang diberikan pengguna disimpan utuh pada `apps/web/public/images/payments/qris-demo.jpg`; tampilan memakai rasio asli dan menyediakan unduhan berkas lengkap.

Pembayar membuka QRIS, membaca penjelasan demo, mencentang pemahaman simulasi, lalu memilih **Simulasikan pembayaran berhasil**. Hasil tersimpan di server dan dapat dilihat kedua peserta setelah refresh. Tidak ada pemindaian, transfer, pemeriksaan bank, gateway, atau webhook pembayaran. Status **Simulasi berhasil** bukan bukti transfer. Metode selalu QRIS dan mode selalu DEMO; API tidak menerima nominal atau metode dari browser.

`GET /transactions/:id/demo-payment` mengembalikan status NOT_REQUIRED, UNPAID, atau PAID beserta nominal, pihak, versi, dan izin. `POST /transactions/:id/demo-payment/confirm` menerima `{ expectedVersion, demoOnly: true }` dan Idempotency-Key. Endpoint terbatas pada peserta; hanya pembayar dapat mengonfirmasi. Transaksi ditutup, sengketa, pembatalan menunggu, akun tidak aktif, atau email belum terverifikasi menghalangi simulasi baru. Pemulihan menggunakan operasi `demo-pay:<transactionId>`.

Migrasi aditif `20261115160000_demo_qris` menambah tabel DemoPayment dengan satu hasil per transaksi. Constraint database membatasi mode DEMO, metode QRIS, dan nominal positif. Pengulangan permintaan tidak menggandakan hasil atau versi. Data lama tidak dibuatkan simulasi rekaan.

Simulasi tidak mengonfirmasi barang atau memindahkan kepemilikan sendiri. Resell mempertahankan alur konfirmasi barang yang ada. Untuk Exchange, hasil demo dengan nominal/pihak yang tepat dapat memenuhi langkah tambahan uang; seluruh konfirmasi barang tetap diperlukan. Ini tidak membuat CashConfirmation atau laporan penerimaan uang sungguhan. Jika seluruh barang sudah dikonfirmasi, simulasi tambahan uang dapat menyelesaikan transaksi demo tersebut. Endpoint konfirmasi uang lama tetap kompatibel untuk riwayat/alur lama.

Validasi mencakup akses peserta/pembayar, penolakan nominal/metode buatan browser, versi lama, replay dan pemulihan, pembatalan, donasi gratis, serta tambahan uang oleh kedua arah Exchange. Pengujian browser memeriksa gambar utuh 1200×1700, tampilan desktop/ponsel, status setelah reload, ketidakpastian respons, dan review versi lama.
