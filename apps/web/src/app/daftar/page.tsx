import { AuthShell } from '@/components/layout/auth-shell';
import { RegisterForm } from '@/features/auth/forms';
export default function Page() { return <AuthShell title="Buat akun" description="Mulai simpan cerita barangmu di Valora."><RegisterForm /></AuthShell>; }
