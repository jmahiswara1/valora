'use client';
import { useEffect, useId, useRef } from 'react';
import { Button } from '@/components/ui/primitives';
export function HandoverDialog({ title, children, footer, busy, onClose, onSubmit, submitLabel, unavailable = false }: { title: string; children: React.ReactNode; footer?: React.ReactNode; busy: boolean; onClose: () => void; onSubmit?: () => Promise<void>; submitLabel?: string; unavailable?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null); const titleId = useId();
  useEffect(() => { const trigger = document.activeElement as HTMLElement | null; const dialog = ref.current; dialog?.showModal(); return () => { dialog?.close(); trigger?.focus(); }; }, []);
  return <dialog ref={ref} className="transaction-dialog handover-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}><h2 id={titleId}>{title}</h2>
    <form className="form-stack" onSubmit={async event => { event.preventDefault(); if (!busy && !unavailable) await onSubmit?.(); }}><fieldset className="handover-fieldset form-stack" disabled={busy || unavailable}>{children}</fieldset><div className="form-actions">{onSubmit && <Button type="submit" disabled={busy || unavailable}>{busy ? 'Menyimpan…' : submitLabel}</Button>}<Button type="button" variant="quiet" disabled={busy} onClick={onClose}>{onSubmit ? 'Kembali' : 'Tutup'}</Button></div></form>{footer && <div className="handover-feedback">{footer}</div>}
  </dialog>;
}
