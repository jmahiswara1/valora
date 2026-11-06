'use client';
import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/primitives';
export function HandoverDialog({ title, description, children, footer, busy, onClose, onSubmit, submitLabel, unavailable = false, proposal = false }: { title: string; description?: string; children: React.ReactNode; footer?: React.ReactNode; busy: boolean; onClose: () => void; onSubmit?: () => Promise<void>; submitLabel?: string; unavailable?: boolean; proposal?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null), heading = useRef<HTMLHeadingElement>(null); const titleId = useId();
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null; const dialog = ref.current;
    const overflow = document.body.style.overflow;
    dialog?.showModal(); document.body.style.overflow = 'hidden'; heading.current?.focus({ preventScroll: true });
    return () => { dialog?.close(); document.body.style.overflow = overflow; trigger?.focus(); };
  }, []);
  return <dialog ref={ref} className={`transaction-dialog handover-dialog${proposal ? ' handover-proposal-dialog' : ''}`} aria-labelledby={titleId} aria-describedby={description ? titleId + '-description' : undefined} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header className="handover-dialog-header"><div><h2 ref={heading} id={titleId} tabIndex={-1}>{title}</h2>{description && <p id={titleId + '-description'}>{description}</p>}</div><button type="button" className="handover-dialog-close" aria-label="Tutup dialog" disabled={busy} onClick={onClose}><X size={20} aria-hidden="true" /></button></header>
    <form className="handover-dialog-form" aria-busy={busy} onSubmit={async event => { event.preventDefault(); if (!busy && !unavailable) await onSubmit?.(); }}>
      <div className="handover-dialog-body"><fieldset className="handover-fieldset form-stack" disabled={busy || unavailable}>{children}</fieldset>{footer && <div className="handover-feedback">{footer}</div>}</div>
      <footer className="handover-dialog-actions"><Button type="button" variant="quiet" disabled={busy} onClick={onClose}>{onSubmit ? 'Kembali' : 'Tutup'}</Button>{onSubmit && <Button type="submit" disabled={busy || unavailable}>{busy ? 'Menyimpan…' : submitLabel}</Button>}</footer>
    </form>
  </dialog>;
}
