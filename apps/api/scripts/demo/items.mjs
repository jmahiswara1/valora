import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

const base = 'http://127.0.0.1:4003';
const local = dotenv.parse(await readFile('.env.local').catch(() => Buffer.from('')));
const appEnv = local.APP_ENV ?? process.env.APP_ENV ?? 'local';
if (appEnv !== 'local') throw new Error('Seed Item demo hanya boleh dijalankan dengan APP_ENV=local.');

const databaseUrl = local.DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL belum diatur pada apps/api/.env.local.');
let databaseHost;
try { databaseHost = new URL(databaseUrl).hostname; } catch { throw new Error('DATABASE_URL tidak valid.'); }
if (!['127.0.0.1', 'localhost', '::1'].includes(databaseHost)) throw new Error('Seed Item demo hanya menerima DATABASE_URL ke PostgreSQL lokal.');

const localRoot = resolve(process.cwd(), '../../.local');
const credentialsPath = resolve(localRoot, 'demo-credentials.json');
const manifestPath = resolve(localRoot, 'demo-items-fixtures.json');
await readFile(credentialsPath).catch(() => { throw new Error('Akun demo belum tersedia. Jalankan pnpm db:seed terlebih dahulu.'); });

const families = [
  {
    key: 'books', image: 'books.png', categoryCode: 'books', subcategoryCode: null,
    titles: ['Koleksi Novel Perjalanan', 'Buku Resep Nusantara', 'Ensiklopedia Alam Anak', 'Panduan Berkebun di Rumah', 'Kumpulan Cerita Pendek', 'Atlas Dunia Edisi Lama', 'Panduan Dasar Fotografi', 'Komik Petualangan Koleksi'],
    types: ['RESELL', 'RESELL', 'RESELL', 'RESELL', 'RESELL', 'EXCHANGE', 'DONATE', 'DONATE'],
    contextAnswer: 'Buku bacaan umum disimpan di tempat kering; halaman inti dan jilid masih utuh.', replacementBase: 180_000, replacementStep: 15_000, weight: 450,
    description: 'Koleksi buku bacaan bekas yang masih rapi untuk dibaca kembali.',
  },
  {
    key: 'furniture', image: 'chair.png', categoryCode: 'furniture', subcategoryCode: null,
    titles: ['Kursi Makan Kayu Solid', 'Kursi Belajar Sandaran Tinggi', 'Kursi Serbaguna Minimalis', 'Kursi Ruang Baca Klasik', 'Kursi Kerja Kayu Ringkas', 'Kursi Teras Sandaran', 'Kursi Lipat untuk Rumah', 'Kursi Makan Gaya Natural'],
    types: ['RESELL', 'RESELL', 'RESELL', 'RESELL', 'RESELL', 'EXCHANGE', 'EXCHANGE', 'DONATE'],
    contextAnswer: 'Kursi kayu untuk penggunaan indoor; rangka, kaki, dan sambungan stabil saat diperiksa.', replacementBase: 1_200_000, replacementStep: 80_000, weight: 4_200,
    description: 'Kursi kayu pakai ulang dengan rangka yang masih kokoh dan siap digunakan.',
  },
  {
    key: 'electronics', image: 'keyboard.png', categoryCode: 'electronics', subcategoryCode: null,
    titles: ['Keyboard Mekanis Kompak', 'Keyboard Mekanis Full Size', 'Keyboard Kabel Low Profile', 'Keyboard Kerja 75 Persen', 'Keyboard Mekanis Keycap Netral', 'Keyboard Kantor Ergonomis', 'Keyboard Tenkeyless Kabel', 'Keyboard Kompak untuk Belajar'],
    types: ['RESELL', 'RESELL', 'RESELL', 'RESELL', 'RESELL', 'EXCHANGE', 'EXCHANGE', 'DONATE'],
    contextAnswer: 'Keyboard komputer memakai daya USB 5V, tidak memakai baterai, dan tidak memiliki kabel terbuka.', replacementBase: 850_000, replacementStep: 65_000, weight: 780,
    description: 'Keyboard komputer kabel untuk penggunaan harian dengan fungsi tombol yang masih baik.',
  },
  {
    key: 'board-games', image: 'board-game.png', categoryCode: 'hobby', subcategoryCode: 'board-games',
    titles: ['Permainan Papan Strategi Hutan', 'Permainan Papan Jelajah Kota', 'Permainan Papan Taktik Laut', 'Permainan Papan Keluarga', 'Permainan Papan Rute Nusantara', 'Permainan Papan Susun Kata', 'Permainan Papan Misi Angkasa', 'Permainan Papan Strategi Kebun'],
    types: ['RESELL', 'RESELL', 'RESELL', 'RESELL', 'EXCHANGE', 'EXCHANGE', 'DONATE', 'DONATE'],
    contextAnswer: 'Permainan papan generik; papan dan komponen inti lengkap sesuai daftar inventaris demo.', replacementBase: 360_000, replacementStep: 25_000, weight: 1_250,
    description: 'Permainan papan keluarga dengan komponen inti lengkap untuk sesi bermain berikutnya.',
  },
  {
    key: 'arts-crafts', image: 'craft-tools.png', categoryCode: 'hobby', subcategoryCode: 'arts-crafts',
    titles: ['Set Cat Air dan Kuas', 'Buku Sketsa dan Pensil Warna', 'Peralatan Kerajinan Kertas', 'Set Kuas Lukis Pemula', 'Perlengkapan Menggambar Dasar', 'Set Alat Kerajinan Tekstil', 'Paket Kertas untuk Kreasi', 'Peralatan Seni untuk Rumah'],
    types: ['RESELL', 'RESELL', 'RESELL', 'RESELL', 'RESELL', 'EXCHANGE', 'DONATE', 'DONATE'],
    contextAnswer: 'Perlengkapan seni kering; seluruh alat tangan dan bahan yang disertakan teridentifikasi.', replacementBase: 250_000, replacementStep: 20_000, weight: 900,
    description: 'Perlengkapan seni dan kerajinan yang masih layak dipakai untuk proyek kreatif berikutnya.',
  },
];

const owners = ['owner.demo@valora.local', 'member.demo@valora.local'];
const definitions = families.flatMap((family, familyIndex) => family.titles.map((name, index) => {
  const globalIndex = familyIndex * family.titles.length + index;
  return {
    key: `${family.key}-${String(index + 1).padStart(2, '0')}`,
    familyKey: family.key,
    image: family.image,
    categoryCode: family.categoryCode,
    subcategoryCode: family.subcategoryCode,
    title: `Demo Market · ${family.key} · ${String(index + 1).padStart(2, '0')} · ${name}`,
    description: `Data simulasi Valora untuk demonstrasi. ${family.description}`,
    contextAnswer: family.contextAnswer,
    type: family.types[index],
    ownerEmail: owners[globalIndex % owners.length],
    replacementPriceIdr: family.replacementBase + index * family.replacementStep,
    weightGrams: family.weight + index * 35,
    purchaseYear: 2020 + globalIndex % 6,
  };
}));

assert.equal(definitions.length, 40);
const expectedTypeCounts = { RESELL: 24, EXCHANGE: 8, DONATE: 8 };
const typeCounts = Object.fromEntries(Object.keys(expectedTypeCounts).map((type) => [type, definitions.filter((row) => row.type === type).length]));
assert.deepEqual(typeCounts, expectedTypeCounts);

const assetDirectory = resolve(process.cwd(), 'prisma/data/demo-items');
const photos = new Map();
for (const fileName of [...new Set(definitions.map((entry) => entry.image))]) {
  const bytes = await readFile(resolve(assetDirectory, fileName)).catch(() => { throw new Error(`Aset gambar demo tidak ditemukan: ${fileName}`); });
  if (bytes.length < 1 || bytes.length > 8 * 1024 * 1024) throw new Error(`Aset gambar tidak memenuhi batas unggah 8 MiB: ${fileName}`);
  photos.set(fileName, bytes);
}

async function assertPortFree(port) {
  await new Promise((resolvePromise, reject) => {
    const probe = createServer();
    probe.once('error', () => reject(new Error(`Port ${port} sedang dipakai. Hentikan demo API lain sebelum menjalankan seed.`)));
    probe.listen(port, '127.0.0.1', () => probe.close((error) => error ? reject(error) : resolvePromise()));
  });
}

function newManifest() {
  return {
    version: 1,
    synthetic: true,
    status: 'IN_PROGRESS',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    imageVariants: [...photos.keys()],
    counts: { items: definitions.length, listings: expectedTypeCounts },
    items: definitions.map((entry) => ({ ...entry, itemId: null, assessmentId: null, listingId: null, status: 'PENDING' })),
  };
}

let manifest;
try {
  manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.version !== 1 || !Array.isArray(manifest.items)) throw new Error('versi atau bentuk manifest tidak dikenal');
  const existingKeys = new Set(manifest.items.map((entry) => entry.key));
  if (definitions.some((entry) => !existingKeys.has(entry.key)) || manifest.items.length !== definitions.length) throw new Error('isi manifest tidak cocok dengan seed versi ini');
  manifest.items = definitions.map((definition) => ({ ...definition, ...manifest.items.find((entry) => entry.key === definition.key) }));
} catch (error) {
  if (error?.code !== 'ENOENT') throw new Error(`Manifest demo Item tidak dapat dibaca: ${error.message}`);
  manifest = newManifest();
}

await assertPortFree(4003);
await mkdir(localRoot, { recursive: true });

async function persistManifest() {
  manifest.updatedAt = new Date().toISOString();
  const temporaryPath = manifestPath + '.tmp';
  await writeFile(temporaryPath, JSON.stringify(manifest, null, 2) + '\n');
  await rename(temporaryPath, manifestPath);
}

function fixtureRoutes(itemId, listingId) {
  return {
    item: `/app/barang/${itemId}`,
    listing: `/market/${listingId}`,
    ownerListing: `/app/listings/${listingId}`,
  };
}

await persistManifest();
process.env.VALORA_SMOKE_URL = base;
const server = spawn(process.execPath, ['dist/main.js'], {
  env: { ...process.env, ...local, APP_ENV: 'local', API_PORT: '4003' },
  windowsHide: true,
  stdio: ['ignore', 'ignore', 'inherit'],
});

try {
  let ready = false;
  for (let attempt = 0; attempt < 150; attempt++) {
    if (server.exitCode !== null) throw new Error('API demo berhenti sebelum siap.');
    try {
      const response = await fetch(base + '/api/v1/categories');
      if (response.ok) { ready = true; break; }
    } catch { /* API startup is still in progress. */ }
    await new Promise((done) => setTimeout(done, 200));
  }
  if (!ready) throw new Error('API demo tidak siap dalam 30 detik.');

  const { login, check, approve } = await import("../helpers/fixtures.mjs");
  const ownerAccounts = new Map();
  const ownerProfiles = new Map();
  for (const email of owners) {
    const account = await login(email);
    const profile = check(await account.request('/me'), 200, `Profil ${email}`);
    if (profile.role !== 'USER' || profile.status !== 'ACTIVE' || !profile.emailVerifiedAt || !profile.city?.id) {
      throw new Error(`Akun demo ${email} harus aktif, terverifikasi, dan memiliki kota.`);
    }
    ownerAccounts.set(email, account);
    ownerProfiles.set(email, profile);
  }
  const admin = await login('admin.demo@valora.local');
  const adminProfile = check(await admin.request('/me'), 200, 'Profil admin demo');
  if (adminProfile.role !== 'ADMIN' || adminProfile.status !== 'ACTIVE' || !adminProfile.emailVerifiedAt) throw new Error('Akun admin demo harus aktif dan terverifikasi.');

  async function listItems(account) {
    const rows = [];
    let cursor = null;
    do {
      const query = new URLSearchParams({ limit: '50' });
      if (cursor) query.set('cursor', cursor);
      const response = await account.request(`/items?${query}`);
      check(response, 200, 'Daftar Item privat');
      rows.push(...response.payload.data);
      cursor = response.payload.meta?.nextCursor ?? null;
    } while (cursor);
    return rows;
  }

  const itemsByOwner = new Map();
  const itemByTitle = new Map();
  const listingsByOwner = new Map();
  for (const email of owners) {
    const account = ownerAccounts.get(email);
    const rows = await listItems(account);
    for (const row of rows) {
      if (!row.title.startsWith('Demo Market · ')) continue;
      if (itemByTitle.has(row.title)) throw new Error(`Ada Item demo ganda dengan judul: ${row.title}`);
      itemByTitle.set(row.title, { ...row, ownerEmail: email });
    }
    itemsByOwner.set(email, rows);
    listingsByOwner.set(email, check(await account.request('/listings/mine'), 200, 'Daftar Listing pemilik'));
  }

  const referenceDate = new Date().toISOString().slice(0, 10);
  const source = (amountIdr, sourceNote) => ({ amountIdr, sourceType: 'USER_ESTIMATE', sourceNote, referenceDate });

  async function createSeedItem(account, definition) {
    const photo = photos.get(definition.image);
    const ticket = check(await account.request('/media/tickets', { method: 'POST', body: {
      fileName: definition.image, mime: 'image/png', bytes: photo.length,
    } }), 201, `Tiket foto ${definition.key}`);
    check(await account.request(`/media/uploads/${ticket.ticketId}`, { method: 'PUT', body: photo, type: 'image/png' }), 200, `Unggah foto ${definition.key}`);
    return check(await account.request('/items', { method: 'POST', body: {
      title: definition.title,
      description: definition.description,
      categoryCode: definition.categoryCode,
      ...(definition.subcategoryCode ? { subcategoryCode: definition.subcategoryCode } : {}),
      functionSummary: 'Fungsi utama berjalan untuk penggunaan sesuai jenis barang.',
      conditionSummary: 'Data kondisi simulasi: terdapat bekas pakai ringan dan tidak ada kerusakan struktur.',
      completenessSummary: 'Data demo menyatakan bagian inti tersedia.',
      issueSummary: 'Keausan kosmetik ringan; tidak memerlukan perbaikan sebelum digunakan.',
      purchaseYear: definition.purchaseYear,
      originalPriceIdr: definition.replacementPriceIdr,
      estimatedWeightGrams: definition.weightGrams,
      uploadTicketIds: [ticket.ticketId],
    } }), 201, `Buat Item ${definition.key}`);
  }

  async function currentAssessment(account, item, definition) {
    const query = new URLSearchParams({ limit: '50' });
    const history = check(await account.request(`/items/${item.id}/assessments?${query}`), 200, `Riwayat Assessment ${definition.key}`);
    const recommendationAction = definition.type === 'RESELL' ? 'RESELL' : definition.type;
    const eligible = (assessment) => assessment.isCurrent && assessment.status === 'COMPLETE'
      && assessment.recommendations.some((entry) => entry.action === recommendationAction && entry.status === 'ELIGIBLE');
    const existing = history.find(eligible);
    if (existing) return existing;

    const rubricQuery = new URLSearchParams();
    if (definition.subcategoryCode) rubricQuery.set('subcategoryCode', definition.subcategoryCode);
    const rubricPath = `/categories/${definition.categoryCode}/rubric${rubricQuery.size ? `?${rubricQuery}` : ''}`;
    const rubric = check(await account.request(rubricPath), 200, `Rubrik ${definition.key}`);
    const replacement = definition.replacementPriceIdr;
    const resaleEstimate = Math.round(replacement * 0.72);
    const assessment = check(await account.request(`/items/${item.id}/assessments`, { method: 'POST', body: {
      expectedItemRevision: item.itemRevision,
      rubricVersionId: rubric.id,
      contextAnswer: definition.contextAnswer,
      hasIssue: true,
      repairNeeded: false,
      answers: {
        function: 'LEVEL_75', physical: 'LEVEL_75', completeness: 'LEVEL_100',
        repairMethod: 'LEVEL_75', repairSupport: 'LEVEL_75', reuse: 'LEVEL_75',
      },
      safetyAnswers: Object.fromEntries(rubric.safetyQuestions.map((question) => [question.code, 'TIDAK'])),
      economic: {
        estimatedResaleValue: source(resaleEstimate, 'Estimasi sintetis untuk Item demo Valora.'),
        estimatedRepairCost: source(0, 'NOT_NEEDED: tidak perlu perbaikan.'),
        comparableReplacementPrice: source(replacement, 'Pembanding sintetis untuk demonstrasi Valora.'),
      },
    } }), 201, `Assessment ${definition.key}`);
    assert.equal(assessment.status, 'COMPLETE', `Assessment ${definition.key} harus lengkap`);
    assert(assessment.recommendations.some((entry) => entry.action === recommendationAction && entry.status === 'ELIGIBLE'), `Rekomendasi ${recommendationAction} harus eligible untuk ${definition.key}`);
    return assessment;
  }

  function listingBody(definition, item, assessment, cityId) {
    const revision = {
      assessmentId: assessment.id,
      expectedItemVersion: item.version,
      type: definition.type,
      title: definition.title,
      description: `${definition.description} Foto katalog mewakili kategori; kondisi unit pada data ini bersifat simulasi.`,
      mediaIds: item.media.map((media) => media.id),
      cityId,
      conditionDisclosure: 'Data kondisi ini simulasi. Foto katalog dipakai ulang untuk Item sejenis dan bukan foto unit individual.',
      handoverMethods: ['MEETUP'],
    };
    if (definition.type === 'RESELL') revision.askingPriceIdr = Math.floor((definition.replacementPriceIdr * 0.52) / 5000) * 5000;
    if (definition.type === 'EXCHANGE') revision.exchangePreference = 'Terbuka untuk barang sejenis dalam kondisi layak pakai.';
    if (definition.type === 'DONATE') revision.recipientNote = 'Data simulasi untuk memperagakan jalur Donate.';
    return revision;
  }

  async function verifyActiveListing(account, listingId, definition) {
    const publicListing = check(await account.request(`/market/${listingId}`), 200, `Listing publik ${definition.key}`);
    assert.equal(publicListing.status, 'ACTIVE');
    assert.equal(publicListing.type, definition.type);
    assert.equal(publicListing.revision.title, definition.title);
    assert.equal(publicListing.revision.media.length, 1);
    const media = publicListing.revision.media[0];
    const photoResponse = await fetch(base + media.url);
    assert.equal(photoResponse.status, 200, `Foto publik ${definition.key} dapat dibaca`);
    assert.equal(photoResponse.headers.get('content-type'), 'image/webp');
    return publicListing;
  }

  for (let index = 0; index < definitions.length; index++) {
    const definition = definitions[index];
    const manifestEntry = manifest.items.find((entry) => entry.key === definition.key);
    const account = ownerAccounts.get(definition.ownerEmail);
    let item;

    if (manifestEntry.itemId) {
      item = check(await account.request(`/items/${manifestEntry.itemId}`), 200, `Item tersimpan ${definition.key}`);
    } else {
      const existing = itemByTitle.get(definition.title);
      if (existing) {
        if (existing.ownerEmail !== definition.ownerEmail) throw new Error(`Item ${definition.title} ada pada akun demo yang berbeda.`);
        item = existing;
      } else {
        item = await createSeedItem(account, definition);
        itemsByOwner.get(definition.ownerEmail).push(item);
        itemByTitle.set(definition.title, { ...item, ownerEmail: definition.ownerEmail });
      }
      manifestEntry.itemId = item.id;
      manifestEntry.status = 'ITEM_READY';
      await persistManifest();
    }

    if (item.categoryCode !== definition.categoryCode || item.subcategoryCode !== definition.subcategoryCode || item.media.length < 1) {
      throw new Error(`Item demo ${definition.key} tidak cocok dengan definisi kategori/foto seed; tidak membuat duplikat.`);
    }

    let listing = listingsByOwner.get(definition.ownerEmail).find((row) => row.itemId === item.id) ?? null;
    if (manifestEntry.listingId) {
      listing = check(await account.request(`/listings/${manifestEntry.listingId}`), 200, `Listing tersimpan ${definition.key}`);
    }
    if (listing && listing.type !== definition.type) throw new Error(`Tipe Listing ${definition.key} berubah; seed tidak akan membuat duplikat.`);

    if (listing?.status === 'ACTIVE') {
      await verifyActiveListing(account, listing.id, definition);
      manifestEntry.listingId = listing.id;
      manifestEntry.routes = fixtureRoutes(item.id, listing.id);
      manifestEntry.status = 'ACTIVE';
      await persistManifest();
      continue;
    }
    if (listing && !['DRAFT', 'PENDING_REVIEW'].includes(listing.status)) {
      throw new Error(`Listing ${definition.key} berstatus ${listing.status}; seed tidak akan menimpa keputusan atau membuat duplikat.`);
    }

    const assessment = await currentAssessment(account, item, definition);
    manifestEntry.assessmentId = assessment.id;
    manifestEntry.status = 'ASSESSMENT_READY';
    await persistManifest();

    if (!listing) {
      listing = check(await account.request(`/items/${item.id}/listings`, { method: 'POST', body: listingBody(definition, item, assessment, ownerProfiles.get(definition.ownerEmail).city.id) }), 201, `Buat Listing ${definition.key}`);
      listingsByOwner.get(definition.ownerEmail).push(listing);
      manifestEntry.listingId = listing.id;
      manifestEntry.status = 'DRAFT';
      await persistManifest();
    }

    if (listing.status === 'DRAFT') {
      listing = check(await account.request(`/listings/${listing.id}/submit`, { method: 'POST', body: { expectedVersion: listing.version } }), 201, `Ajukan Listing ${definition.key}`);
      manifestEntry.status = 'PENDING_REVIEW';
      await persistManifest();
    }

    if (listing.status === 'PENDING_REVIEW') {
      listing = await approve(admin, listing, 'Listing sintetis untuk demonstrasi katalog Valora.');
    }
    await verifyActiveListing(account, listing.id, definition);
    manifestEntry.listingId = listing.id;
    manifestEntry.routes = fixtureRoutes(item.id, listing.id);
    manifestEntry.status = 'ACTIVE';
    await persistManifest();
    console.log(`[${index + 1}/40] ${definition.type}: ${definition.title}`);
  }

  const guest = (await import("../helpers/fixtures.mjs")).client();
  const query = new URLSearchParams({ q: 'Demo Market ·', limit: '50' });
  const marketPage = check(await guest.request(`/market?${query}`), 200, 'Verifikasi Market demo');
  assert.equal(marketPage.length, definitions.length, 'Market harus menampilkan tepat 40 Listing seed');
  const marketCounts = Object.fromEntries(Object.keys(expectedTypeCounts).map((type) => [type, marketPage.filter((row) => row.type === type).length]));
  assert.deepEqual(marketCounts, expectedTypeCounts, 'Market harus berisi komposisi Resell/Exchange/Donate yang ditetapkan');
  assert.equal(new Set(manifest.items.map((entry) => entry.image)).size, 5, 'Seed harus memakai tepat lima varian visual');
  manifest.status = 'COMPLETE';
  await persistManifest();
  console.log(`Seed Item selesai: ${definitions.length} Listing aktif (${marketCounts.RESELL} Resell, ${marketCounts.EXCHANGE} Exchange, ${marketCounts.DONATE} Donate), 5 foto katalog. Rute: .local/demo-items-fixtures.json`);
} finally {
  server.kill();
}
