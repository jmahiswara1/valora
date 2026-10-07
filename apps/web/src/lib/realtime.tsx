'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const Context = createContext(false);
export function ConversationRealtime({ sessionId, children }: { sessionId?: string | null; children: React.ReactNode }) {
  const cache = useQueryClient();
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!sessionId) return;
    const source = new EventSource('/api/v1/conversations/stream', { withCredentials: true });
    const invalidate = (id?: string) => {
      for (const key of [['conversations'], ['conversation-unread'], ['notification-center'], ...(id ? [['conversation', id], ['conversation-messages', id]] : [['conversation'], ['conversation-messages']])]) void cache.invalidateQueries({ queryKey: key });
    };
    source.onopen = () => { setConnected(true); invalidate(); };
    source.onerror = () => setConnected(false);
    const receive = (event: MessageEvent) => {
      try { const data = JSON.parse(event.data) as { conversationId?: string }; if (typeof data.conversationId === 'string') invalidate(data.conversationId); } catch { /* Contents are fetched through authenticated REST. */ }
    };
    source.addEventListener('conversation', receive);
    return () => { source.removeEventListener('conversation', receive); source.close(); };
  }, [sessionId, cache]);
  return <Context.Provider value={Boolean(sessionId) && connected}>{children}</Context.Provider>;
}
export const useConversationRealtime = () => useContext(Context);
