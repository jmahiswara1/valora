'use client';

import Link from 'next/link';
import type { ComponentProps, MouseEvent } from 'react';
import { useChat } from './context';

export function isPlainClick(event: MouseEvent<HTMLAnchorElement>) {
  return !event.defaultPrevented && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && (!event.currentTarget.target || event.currentTarget.target === '_self');
}

export function ChatLink({ conversationId, children, onClick, ...props }: Omit<ComponentProps<typeof Link>, 'href'> & { conversationId?: string }) {
  const chat = useChat();
  return <Link {...props} href={conversationId ? `/pesan/${conversationId}` : '/pesan'} prefetch={false} onClick={event => {
    onClick?.(event);
    if (isPlainClick(event)) { event.preventDefault(); chat.open(conversationId); }
  }}>{children}</Link>;
}
