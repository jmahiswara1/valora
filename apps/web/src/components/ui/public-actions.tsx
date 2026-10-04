'use client';

import type { ReactNode } from 'react';
import { useSession } from '@/lib/session';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export function RecordItemLink({
  children = 'Catat barangmu',
  className = 'button button-primary',
}: {
  children?: ReactNode;
  className?: string;
}) {
  const session = useSession();
  const href = session.state === 'AUTHENTICATED' ? '/app/barang/baru' : '/daftar';

  return <Link href={href} className={className}>{children}<ArrowUpRight size={18} aria-hidden="true" /></Link>;
}
