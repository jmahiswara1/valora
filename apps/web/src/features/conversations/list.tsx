'use client';

import { MessageCircle } from 'lucide-react';
import { ConversationPane } from './pane';

export function ConversationsPage() {
  return <div className="account-message-workspace">
    <ConversationPane />
    <section className="account-chat-placeholder">
      <MessageCircle size={36} strokeWidth={1.5} aria-hidden="true" />
      <h2>Pilih percakapan.</h2>
      <p>Pesan dan detail barang akan tampil di sini. Kesepakatan tetap dicatat lewat penawaran.</p>
    </section>
  </div>;
}
