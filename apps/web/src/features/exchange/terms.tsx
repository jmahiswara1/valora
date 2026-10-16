'use client';

import type { ExchangeTerms } from '@valora/contracts';
import { PrivatePhoto } from '@/features/items/photo';
import { money } from '@/features/market/process-shared';

export function ExchangeTermsView({ terms, ownerLabel = 'Pemilik Listing', bidderLabel = 'Penawar' }: { terms: ExchangeTerms; ownerLabel?: string; bidderLabel?: string }) {
  const cash = terms.cashAdjustment;
  return <div className="exchange-terms">
    <div className="exchange-bundles">{[{ label: ownerLabel, items: terms.ownerItems }, { label: bidderLabel, items: terms.bidderItems }].map((side, index) => <section key={index} className="exchange-bundle"><h3>Dari {side.label} <span className="meta">{side.items.length} barang</span></h3><ul>{side.items.map(item => <li className="exchange-item" key={item.id}><PrivatePhoto mediaId={item.mediaIds[0]} alt={'Foto ' + item.title} /><div><strong>{item.title}</strong>{item.conditionSummary && <p>{item.conditionSummary}</p>}<details><summary>Lihat cerita barang</summary><p className="preserve-lines">{item.description}</p></details></div></li>)}</ul></section>)}</div>
    <div className="exchange-cash-summary"><strong>{cash ? 'Tambahan uang ' + money(cash.amountIdr) : 'Tanpa tambahan uang'}</strong>{cash && <p>{cash.payer === 'OWNER' ? ownerLabel : bidderLabel} memberikan kepada {cash.payer === 'OWNER' ? bidderLabel : ownerLabel}.</p>}</div>
  </div>;
}
