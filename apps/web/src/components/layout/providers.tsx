'use client';

import { SessionProvider } from '@/lib/session';
import { ChatProvider } from '@/features/conversations/provider';
import { ChatDraftProvider } from '@/features/conversations/drafts';
import { AiLauncher } from '@/features/tutorials/ai-launcher';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ChatDraftProvider>
        <ChatProvider>
          {children}
          <AiLauncher />
        </ChatProvider>
      </ChatDraftProvider>
    </SessionProvider>
  );
}