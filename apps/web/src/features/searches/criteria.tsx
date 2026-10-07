'use client';
import { useQuery } from '@tanstack/react-query';
import type { MarketSearchFilters, CategoryDto, CityDto } from '@valora/contracts';
import { api } from '@/lib/api';

export function useSearchLabels(filters: MarketSearchFilters) {
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api<CategoryDto[]>('/categories'), staleTime: 60000 });
  const cities = useQuery({ queryKey: ['cities', 'catalog'], queryFn: () => api<CityDto[]>('/cities'), enabled: Boolean(filters.cityId), staleTime: 60000 });
  const city = cities.data?.find(row => row.id === filters.cityId);
  const conditions = { EXCELLENT: 'Sangat baik', GOOD: 'Baik', NEEDS_ATTENTION: 'Perlu perhatian' };
  const types = { RESELL: 'Jual kembali', EXCHANGE: 'Tukar', DONATE: 'Donasi' };
  const money = (n: number) => 'Rp ' + new Intl.NumberFormat('id-ID').format(n);
  const labels = [filters.q ? `“${filters.q}”` : '', filters.category ? categories.data?.find(row => row.code === filters.category)?.name ?? filters.category : '', filters.type ? types[filters.type] : '', filters.cityId ? city ? `${city.name}, ${city.provinceName}` : 'Kota tersimpan' : '', filters.condition ? conditions[filters.condition] : '', filters.minPriceIdr !== undefined ? `Min. ${money(filters.minPriceIdr)}` : '', filters.maxPriceIdr !== undefined ? `Maks. ${money(filters.maxPriceIdr)}` : ''].filter(Boolean);
  return { labels, cityLabel: city ? `${city.name}, ${city.provinceName}` : '', defaultName: (filters.q || labels.slice(0, 2).join(' · ') || 'Pencarian Market').slice(0, 80) };
}
export function SearchCriteria({ filters }: { filters: MarketSearchFilters }) {
  const { labels } = useSearchLabels(filters);
  return <ul className="saved-search-criteria" aria-label="Kriteria pencarian">{labels.map(label => <li key={label}>{label}</li>)}</ul>;
}
