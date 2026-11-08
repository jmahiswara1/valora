'use client';

import { createContext, useContext } from 'react';

export type ChatContextValue = { open: (id?: string) => void; close: () => void; isOpen: boolean; count?: number };
export const ChatContext = createContext<ChatContextValue | null>(null);
export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error('ChatProvider missing');
  return context;
}
