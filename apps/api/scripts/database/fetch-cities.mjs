import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = 'https://www.emsifa.com/api-wilayah-indonesia/v2';

async function getJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error('HTTP ' + response.status + ' dari ' + url);
  return response.json();
}

const provincesResponse = await getJson(base + '/provinces.json');
const provinces = provincesResponse.data;
if (!Array.isArray(provinces) || provinces.length !== 38) throw new Error('Jumlah provinsi tidak sesuai snapshot yang diharapkan');

const cities = [];
for (const province of provinces) {
  const regenciesResponse = await getJson(base + '/regencies/' + province.id + '.json');
  for (const city of regenciesResponse.data) {
    cities.push({ code: city.id, name: city.name, provinceName: province.name });
  }
}
if (cities.length !== 514 || new Set(cities.map((city) => city.code)).size !== 514) {
  throw new Error('Dataset kota/kabupaten tidak lengkap atau memiliki kode ganda: ' + cities.length);
}
cities.sort((a, b) => a.code.localeCompare(b.code));
const target = resolve(process.cwd(), 'apps/api/prisma/data/cities.json');
await mkdir(resolve(process.cwd(), 'apps/api/prisma/data'), { recursive: true });
await writeFile(target, JSON.stringify({ source: base, sourceUpdatedAt: provincesResponse.meta?.updated_at ?? '2026-09-03', count: cities.length, cities }, null, 2) + '\n');
console.log('Snapshot ' + cities.length + ' kabupaten/kota dari 38 provinsi tersimpan.');
