'use client';

import { SessionProvider } from '@/lib/session';
import { ChatProvider } from '@/features/conversations/provider';
import { ChatDraftProvider } from '@/features/conversations/drafts';

export function Providers({ children }: { children: React.ReactNode }) { return <SessionProvider><ChatDraftProvider><ChatProvider>{children}</ChatProvider></ChatDraftProvider></SessionProvider>; }
