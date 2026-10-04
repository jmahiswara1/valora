'use client';

import { usePathname } from 'next/navigation';
import { AccountShell } from './account-shell';
import { AdminAppShell } from './admin-shell';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return pathname.startsWith('/app/admin') ? <AdminAppShell>{children}</AdminAppShell> : <AccountShell>{children}</AccountShell>;
}
