# Audit dependensi dokumen dengan Graphify

**Snapshot:** PRD v1.12 dan 11 dokumen awal, sebelum penutupan K01–K06 pada 28 September 2026. Graphify mengekstrak 135 node, 249 relasi mentah, dan tiga hyperedge; graph interaktif menyimpan 243 relasi pada 14 komunitas. Artefak: [laporan](../graphify-out/GRAPH_REPORT.md), [graph interaktif](../graphify-out/graph.html), dan [data graph](../graphify-out/graph.json). Snapshot ini dipakai untuk menemukan dependensi; aturan terkini tetap berada pada PRD v1.14 dan docs terkait.

## Hasil yang memandu revisi

| Temuan graph | Hubungan yang perlu dijaga | Tindak lanjut dalam docs |
| --- | --- | --- |
| `Transaction` (18 koneksi), `Listing` (16), dan `Assessment` (13) adalah simpul paling terhubung. | Perubahan status atau data di satu simpul memengaruhi Offer, owner, Passport, dan Impact. | [K01–K06](10-mvp-implementation-decisions.md), [alur](02-flows-and-states.md), [model data](11-data-model.md), dan [API](12-api-contract.md) memakai guard serta snapshot yang sama. |
| Rubrik dan moderasi berada pada komunitas yang berdekatan dengan Assessment/Listing. | Score tinggi tidak boleh melewati larangan keselamatan; `PARTIAL_ECONOMIC` hanya membebaskan ekonomi untuk Donate/Exchange. | [Rubrik](06-category-rubric-draft.md) menetapkan deklarasi wajib dan kasus batas; [moderasi](09-moderation-policy-draft.md) tetap menjadi sumber perlakuan kasus. |
| Transaksi atomik menghubungkan `Transaction`, `OwnershipTransfer`, `PassportEvent`, dan `ImpactEvent` dalam satu hyperedge. | Exchange harus memindahkan dua owner serta menulis jejak secara konsisten. | [Model data](11-data-model.md#transaksi-basis-data-dan-batas-kegagalan) dan [penerimaan](13-acceptance-and-demo.md#kasus-batas-teknis-yang-wajib-lulus) mensyaratkan commit/rollback dan idempotensi. |
| Audit desain menghubungkan badge “TERVERIFIKASI” tanpa objek dengan Valora Score. | Presentasi visual dapat membuat Score berbasis laporan pengguna terlihat seperti verifikasi fisik. | [Audit Pencil](04-pencil-design-review.md) dan [design system](08-design-system.md) melarang badge tersebut tanpa dasar; copy Score menyebut sumber dan batas klaim. |
| Passport dan data Repair bertemu di batas akses owner lama/baru. | Perpindahan owner tidak boleh ikut memindahkan chat, biaya, alamat, atau bukti privat. | [Privasi Passport](07-passport-privacy-draft.md) dan [API](12-api-contract.md#proyeksi-dan-verifikasi-kontrak) mengunci proyeksi per peran. |

Graphify juga menandai 40 node dengan paling banyak satu koneksi. Ini menunjukkan ekstraksi semantik awal yang ringkas dan area yang perlu ditelusuri, **bukan** bukti bahwa 40 fitur belum didokumentasikan. Diagnosis ekstraksi menemukan nol endpoint hilang/dangling dan nol self-loop. Enam relasi berbagi pasangan endpoint dalam graph tak berarah sehingga terlipat dari 249 menjadi 243; relasi mentah tetap ada pada file ekstraksi internal. Keterbatasan ini tidak dipakai sebagai keputusan produk.

Audit ini menjawab pertanyaan graph “mengapa Listing/Transaction/Assessment menghubungkan banyak komunitas?”: ketiganya adalah titik tempat kelayakan, reservasi, transfer, privasi, dan metrik bertemu. Karena itu, spesifikasi mereka ditutup sebelum implementasi kode. Graph interaktif adalah peta snapshot awal; dokumen normatif selalu memakai versi terbaru.
