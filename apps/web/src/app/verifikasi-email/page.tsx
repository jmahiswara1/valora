import { Suspense } from 'react';
import { AuthShell } from '@/components/layout/auth-shell';
import { VerifyEmailForm } from '@/features/auth/forms';
export default function Page() { return <AuthShell title="Verifikasi email" description="Satu langkah lagi untuk menyiapkan akunmu."><Suspense><VerifyEmailForm /></Suspense></AuthShell>; }
