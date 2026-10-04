import { Suspense } from 'react';
import { AuthShell } from '@/components/layout/auth-shell';
import { LoginForm } from '@/features/auth/forms';
export default function Page() { return <AuthShell title="Selamat datang lagi" description="Masuk untuk melihat dan mengelola barangmu."><Suspense fallback={<p role="status">Menyiapkan formulir…</p>}><LoginForm /></Suspense></AuthShell>; }
