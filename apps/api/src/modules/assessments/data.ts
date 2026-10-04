import type { IndicatorKey, RubricQuestion, SafetyQuestion } from '@valora/contracts';

export interface RubricConfig {
  rubricKey: string;
  categoryCode: string;
  subcategoryCode: string | null;
  ruleVersion: 'score-v1';
  policyVersion: 'policy-v1';
  recommendationVersion: 'recommendation-v1';
  questions: RubricQuestion[];
  safetyQuestions: SafetyQuestion[];
  contextPrompt: string | null;
}

const indicators: IndicatorKey[] = ['function', 'physical', 'completeness', 'repairMethod', 'repairSupport', 'reuse'];
const prompts = ['Sejauh mana fungsi utama', 'Bagaimana kondisi fisik', 'Seberapa lengkap', 'Seberapa layak metode perbaikan', 'Seberapa tersedia dukungan perbaikan', 'Seberapa besar potensi penggunaan ulang'];
const anchors: Record<IndicatorKey, string[]> = {
  function: ['tidak berfungsi', 'sebagian besar fungsi gagal', 'berfungsi sebagian dengan batas', 'fungsi utama berjalan dengan masalah kecil', 'berfungsi sesuai tujuan'],
  physical: ['kerusakan berat', 'kerusakan besar', 'kerusakan sedang', 'keausan ringan', 'tanpa kerusakan berarti'],
  completeness: ['bagian inti tidak ada', 'beberapa bagian penting hilang', 'bagian pendukung hilang', 'bagian inti lengkap', 'semua bagian wajib lengkap'],
  repairMethod: ['belum ada cara layak', 'cara sangat tidak pasti', 'perbaikan mungkin dengan usaha', 'metode jelas dan wajar', 'tindakan sederhana dan jelas'],
  repairSupport: ['dukungan tidak tersedia', 'dukungan sulit diperoleh', 'dukungan mungkin tersedia', 'dukungan relatif mudah diakses', 'dukungan tersedia jelas'],
  reuse: ['tidak layak digunakan ulang', 'hanya berguna sangat terbatas', 'berguna bagi penerima tertentu', 'berguna bagi banyak penerima', 'siap digunakan secara luas'],
};
const values = [0, 25, 50, 75, 100] as const;

type SeedEntry = { categoryCode: string; subcategoryCode?: string; objects: [string, string, string, string, string, string]; contextPrompt?: string; safety: [string, string, 'PROHIBITED' | 'SPECIAL_REVIEW' | 'DISCLOSE'][] };
const entries: SeedEntry[] = [
  { categoryCode: 'electronics', objects: ['perangkat termasuk daya dan kontrol', 'bodi, port, dan komponen terpasang', 'komponen wajib perangkat', 'servis masalah yang dilaporkan', 'suku cadang atau teknisi', 'perangkat bagi pemilik berikutnya'], contextPrompt: 'Jenis perangkat, sumber daya, dan jenis baterai bila ada', safety: [
    ['battery_or_wire', 'Apakah baterai menggembung atau kabel daya/komponen listrik terbuka?', 'PROHIBITED'],
    ['unstable_power', 'Apakah daya tidak stabil atau perangkat panas secara tidak wajar?', 'SPECIAL_REVIEW'],
    ['cosmetic_or_accessory', 'Apakah ada goresan atau aksesori opsional yang hilang?', 'DISCLOSE'],
  ] },
  { categoryCode: 'furniture', objects: ['fungsi sesuai jenis furnitur', 'rangka, sambungan, dan permukaan', 'bagian penopang dan pengikat', 'perbaikan sambungan atau struktur', 'bahan dan keahlian furnitur', 'furnitur di ruang berikutnya'], safety: [
    ['unstable_frame', 'Apakah rangka penyangga patah atau tidak stabil?', 'PROHIBITED'],
    ['uncertain_structural_repair', 'Apakah kekuatan perbaikan struktur sebelumnya belum jelas?', 'SPECIAL_REVIEW'],
    ['surface_wear', 'Apakah ada lecet atau warna pudar?', 'DISCLOSE'],
  ] },
  { categoryCode: 'fashion', objects: ['fungsi pakai sesuai jenis dan ukuran', 'kain, jahitan, dan penutup', 'bagian wajib pakaian', 'jahit atau penggantian bagian', 'bahan atau jasa jahit', 'pakaian bagi penerima berikutnya'], safety: [
    ['contamination', 'Apakah ada kontaminasi yang belum ditangani?', 'PROHIBITED'],
    ['unclear_cleanliness', 'Apakah kebersihan atau noda penting belum jelas?', 'SPECIAL_REVIEW'],
    ['minor_wear', 'Apakah warna pudar atau jahitan kecil perlu diungkap?', 'DISCLOSE'],
  ] },
  { categoryCode: 'books', objects: ['keterbacaan isi', 'halaman, jilid, dan sampul', 'halaman atau volume inti', 'perbaikan jilid atau halaman', 'bahan atau jasa perbaikan buku', 'isi bagi pembaca berikutnya'], safety: [
    ['active_mold', 'Apakah ada jamur yang masih tumbuh?', 'PROHIBITED'],
    ['unclear_pages_or_damp', 'Apakah halaman inti atau kelembapan masih meragukan?', 'SPECIAL_REVIEW'],
    ['annotations_or_cover', 'Apakah ada anotasi atau sampul aus?', 'DISCLOSE'],
  ] },
  { categoryCode: 'household', objects: ['fungsi alat sesuai subjenis', 'bodi, bagian daya/panas, dan sambungan', 'bagian wajib untuk operasi', 'servis sesuai sumber daya', 'suku cadang atau teknisi', 'pemakaian rumah tangga berikutnya'], contextPrompt: 'Jenis alat dan sumber daya: listrik, gas, panas, atau manual', safety: [
    ['gas_leak_or_open_wire', 'Apakah ada kebocoran gas atau komponen listrik terbuka?', 'PROHIBITED'],
    ['unstable_heat_or_power', 'Apakah fungsi panas atau daya tidak stabil?', 'SPECIAL_REVIEW'],
    ['cosmetic_dent', 'Apakah ada penyok kosmetik?', 'DISCLOSE'],
  ] },
  { categoryCode: 'sports', objects: ['fungsi sesuai cabang olahraga', 'struktur, pengikat, dan keausan', 'bagian pelindung atau penahan beban', 'perbaikan sesuai alat', 'bagian dan keahlian sesuai alat', 'alat bagi pengguna berikutnya'], contextPrompt: 'Jenis alat dan apakah alat pelindung atau penahan beban', safety: [
    ['damaged_protection', 'Apakah struktur pelindung atau penahan beban rusak?', 'PROHIBITED'],
    ['unclear_impact_history', 'Apakah riwayat benturan atau umur pakai alat keselamatan belum jelas?', 'SPECIAL_REVIEW'],
    ['nonprotective_scuff', 'Apakah ada lecet pada barang nonpelindung?', 'DISCLOSE'],
  ] },
  { categoryCode: 'hobby', subcategoryCode: 'musical-instruments', objects: ['suara atau kontrol instrumen', 'badan, senar/tuts, dan sambungan', 'bagian wajib instrumen', 'servis instrumen', 'bagian atau teknisi instrumen', 'instrumen bagi pemain berikutnya'], contextPrompt: 'Jenis instrumen dan apakah bertenaga listrik', safety: [
    ['open_electrical_part', 'Apakah komponen listrik terbuka?', 'PROHIBITED'],
    ['unclear_crack_or_repair', 'Apakah retak, fungsi, atau repair terdahulu belum jelas?', 'SPECIAL_REVIEW'],
    ['finish_or_tuning', 'Apakah ada lecet finishing atau kebutuhan penyeteman?', 'DISCLOSE'],
  ] },
  { categoryCode: 'hobby', subcategoryCode: 'board-games', objects: ['fungsi bermain', 'papan, kartu, dan komponen', 'komponen inti menurut daftar', 'penggantian komponen', 'dukungan suku komponen', 'permainan bagi pemain berikutnya'], contextPrompt: 'Nama permainan dan jumlah komponen inti menurut daftar', safety: [
    ['missing_core_piece', 'Apakah komponen inti untuk bermain hilang?', 'PROHIBITED'],
    ['component_mismatch', 'Apakah jumlah komponen pada foto, daftar, dan deskripsi berbeda?', 'SPECIAL_REVIEW'],
    ['box_or_card_wear', 'Apakah kotak aus atau kartu tertekuk?', 'DISCLOSE'],
  ] },
  { categoryCode: 'hobby', subcategoryCode: 'arts-crafts', objects: ['fungsi alat atau bahan kerajinan', 'alat, bahan, dan kemasan', 'bagian atau isi wajib', 'perbaikan alat', 'bahan atau keahlian kerajinan', 'alat atau bahan bagi pengguna berikutnya'], contextPrompt: 'Jenis bahan/alat dan labelnya', safety: [
    ['unidentified_material_or_unsafe_tool', 'Apakah bahan tidak teridentifikasi atau bagian kerja alat berisiko?', 'PROHIBITED'],
    ['unclear_package', 'Apakah kemasan, isi, atau foto tidak sesuai label?', 'SPECIAL_REVIEW'],
    ['cosmetic_wear', 'Apakah ada keausan kosmetik?', 'DISCLOSE'],
  ] },
];

export const rubricSeeds: RubricConfig[] = entries.map((entry) => ({
  rubricKey: entry.subcategoryCode ? `${entry.categoryCode}/${entry.subcategoryCode}` : entry.categoryCode,
  categoryCode: entry.categoryCode,
  subcategoryCode: entry.subcategoryCode ?? null,
  ruleVersion: 'score-v1', policyVersion: 'policy-v1', recommendationVersion: 'recommendation-v1',
  contextPrompt: entry.contextPrompt ?? null,
  questions: indicators.map((key, index) => ({
    key,
    prompt: `${prompts[index]} ${entry.objects[index]}?`,
    choices: values.map((value, choiceIndex) => ({ code: `LEVEL_${value}` as const, value, label: `${entry.objects[index]}: ${anchors[key][choiceIndex]}` })),
  })),
  safetyQuestions: entry.safety.map(([code, prompt, effectOnYes]) => ({ code, prompt, effectOnYes })),
}));
