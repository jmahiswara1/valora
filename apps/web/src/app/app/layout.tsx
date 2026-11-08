import { AppShell } from '@/components/layout/app-shell';
import "../../styles/account.css";
import "../../styles/personal-controls.css";
export default function Layout({ children }: { children: React.ReactNode }) { return <AppShell>{children}</AppShell>; }
