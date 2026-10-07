import type { Metadata } from 'next';
import { SavedSearchesPage } from '@/features/searches/list';
export const metadata: Metadata = { title: 'Pencarian tersimpan' };
export default function Page() { return <SavedSearchesPage />; }
