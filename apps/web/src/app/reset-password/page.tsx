import { Suspense } from 'react';
import { AuthShell } from '@/components/layout/auth-shell';
import { ResetConfirmForm } from '@/features/auth/forms';
export default function Page() { return <AuthShell title="Kata sandi baru" description="Buat kata sandi yang belum pernah kamu gunakan."><Suspense><ResetConfirmForm /></Suspense></AuthShell>; }
