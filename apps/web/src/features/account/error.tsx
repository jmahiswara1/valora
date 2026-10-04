'use client';

import type { ReactNode } from 'react';
import { Notice, Button } from "../../components/ui/primitives";

export function AccountError({ children, retry }: { children: ReactNode; retry: () => void }) {
  return <Notice kind="error">{children} <Button type="button" variant="quiet" size="small" onClick={retry}>Coba lagi</Button></Notice>;
}
