'use client';

import { SessionProvider } from '@/lib/session';
import { ChatProvider } from '@/features/conversations/provider';
import { ChatDraftProvider } from '@/features/conversations/drafts';
import { ChatTrigger } from '@/features/conversations/trigger';
import { AiLauncher } from '@/features/tutorials/ai-launcher';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ChatDraftProvider>
        <ChatProvider>
          {children}
          <div className="floating-actions">
            <AiLauncher />
            <ChatTrigger floating />
          </div>
        </ChatProvider>
      </ChatDraftProvider>
    </SessionProvider>
  );
}
