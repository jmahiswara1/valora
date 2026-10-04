import { AuthShell } from '@/components/layout/auth-shell';
import { ResetRequestForm } from '@/features/auth/forms';
export default function Page() { return <AuthShell title="Pulihkan akun" description="Kami akan mengirim tautan untuk membuat kata sandi baru."><ResetRequestForm /></AuthShell>; }
