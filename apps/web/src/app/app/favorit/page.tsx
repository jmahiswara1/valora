import type { Metadata } from 'next';
import { FavoritesPage } from '@/features/favorites/list';

export const metadata: Metadata = { title: 'Favorit' };
export default function Page() { return <FavoritesPage />; }
