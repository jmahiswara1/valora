'use client';

import { useRef, useEffect, useState } from 'react';
import { Button } from "./primitives";

export function ConfirmAction({ title, children, buttonLabel, pending, onConfirm, onClose }: { title: string; children: React.ReactNode; buttonLabel: string; pending: boolean; onConfirm: () => Promise<void>; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const canConfirm = acknowledged && !pending;
  useEffect(() => { const element = dialog.current; const trigger = document.activeElement as HTMLElement | null; element?.showModal(); return () => { element?.close(); trigger?.focus(); }; }, []);
  return <dialog ref={dialog} className="transaction-dialog" aria-labelledby="action-dialog-title" onCancel={(e) => { e.preventDefault(); if (!pending) onClose(); }}>
    <form className="form-stack" onSubmit={async (e) => { e.preventDefault(); if (canConfirm) await onConfirm(); }}><h2 id="action-dialog-title">{title}</h2>{children}<label className="transaction-consent"><input type="checkbox" required checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} disabled={pending} /> Saya memahami tindakan dan barang yang disebutkan.</label><div className="form-actions"><Button type="submit" disabled={!canConfirm}>{pending ? 'Memeriksa…' : buttonLabel}</Button><Button type="button" variant="quiet" disabled={pending} onClick={onClose}>Kembali</Button></div></form>
  </dialog>;
}
