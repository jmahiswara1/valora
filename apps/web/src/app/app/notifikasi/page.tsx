import type { Metadata } from 'next';
import { NotificationsPage } from '@/features/notifications/list';

export const metadata: Metadata = { title: 'Notifikasi' };
export default function Page() { return <NotificationsPage />; }
