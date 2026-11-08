import type { Metadata } from 'next';
import { ChatPageShell } from '@/features/conversations/page-shell';

export const metadata: Metadata = { title: 'Pesan', robots: { index: false, follow: false } };
export default function Layout({ children }: { children: React.ReactNode }) { return <ChatPageShell>{children}</ChatPageShell>; }
