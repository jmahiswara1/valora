'use client';

import { MessageCircle } from 'lucide-react';
import { ConversationPane } from './pane';

export function ConversationsPage({ onSelect }: { onSelect?: (id?: string) => void } = {}) {
  return <div className="account-message-workspace">
    <ConversationPane onSelect={onSelect} />
    <section className="account-chat-placeholder">
      <MessageCircle size={36} strokeWidth={1.5} aria-hidden="true" />
      <h2>Pilih percakapan.</h2>
      <p>Pesan dan detail barang akan tampil di sini. Kesepakatan tetap dicatat lewat penawaran.</p>
    </section>
  </div>;
}
