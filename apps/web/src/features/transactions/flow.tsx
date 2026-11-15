import { Check } from 'lucide-react';
import type { TransactionDto } from '@valora/contracts';
import { time } from './shared';

export function TransactionFlow({ transaction }: { transaction: TransactionDto }) {
  if (transaction.status === 'CANCELLED') return <p className="transaction-flow-note">Transaksi dibatalkan. Barang tetap menjadi milik pemilik semula.</p>;
  const completed = transaction.status === 'COMPLETED';
  return <div className="transaction-flow">
    <ol aria-label="Progres transaksi">
      {['Disepakati', 'Serah terima', 'Selesai'].map((label, index) => {
        const done = completed || index === 0, current = !completed && index === 1;
        return <li key={label} className={done ? 'is-complete' : current ? 'is-current' : ''} aria-current={current ? 'step' : undefined}><span className="transaction-flow-marker" aria-hidden="true">{done && <Check size={14} />}</span><span>{label}</span></li>;
      })}
    </ol>
    <p>{transaction.status === 'DISPUTED' ? 'Penyelesaian ditahan selama sengketa ditinjau admin.' : completed ? 'Transaksi selesai. Lihat riwayat atau berikan ulasan di bawah.' : <>Serah terima paling lambat <time dateTime={transaction.targetHandoverAt}>{time(transaction.targetHandoverAt)}</time>. Transaksi selesai setelah semua konfirmasi lengkap.</>}</p>
  </div>;
}
