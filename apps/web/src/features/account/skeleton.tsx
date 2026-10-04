'use client';



export function AccountSkeleton({ cards = false }: { cards?: boolean }) {
  return <div className={cards ? 'item-grid account-skeleton-grid' : 'account-skeleton-list'} role="status" aria-label="Memuat data">{Array.from({ length: cards ? 4 : 3 }, (_, index) => <div className="account-skeleton" key={index}><div /><span /><span /></div>)}</div>;
}
