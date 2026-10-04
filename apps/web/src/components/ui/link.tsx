'use client';

import Link from 'next/link';

export function AppButtonLink({ href, children }: { href: string; children: React.ReactNode }) { return <Link href={href} className="button button-primary">{children}</Link>; }
