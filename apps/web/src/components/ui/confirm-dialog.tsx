'use client';

import { useRef, useEffect, useState } from 'react';
import { Button } from "./primitives";

export function ConfirmAction({ title, children, buttonLabel, pending, onConfirm, onClose, acknowledgement = 'Saya memahami tindakan dan barang yang disebutkan.' }: { title: string; acknowledgement?: string; children: React.ReactNode; buttonLabel: string; pending: boolean; onConfirm: () => Promise<void>; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const canConfirm = acknowledged && !pending;
  useEffect(() => { const element = dialog.current; const trigger = document.activeElement as HTMLElement | null; element?.showModal(); heading.current?.focus({ preventScroll: true }); return () => { element?.close(); trigger?.focus({ preventScroll: true }); }; }, []);
  return <dialog ref={dialog} className="transaction-dialog" aria-labelledby="action-dialog-title" onCancel={(e) => { e.preventDefault(); if (!pending) onClose(); }}>
    <form className="form-stack" onSubmit={async (e) => { e.preventDefault(); if (canConfirm) await onConfirm(); }}><h2 ref={heading} tabIndex={-1} id="action-dialog-title">{title}</h2>{children}<label className="transaction-consent"><input type="checkbox" required checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} disabled={pending} /> {acknowledgement}</label><div className="form-actions"><Button type="submit" disabled={!canConfirm}>{pending ? 'Memeriksa…' : buttonLabel}</Button><Button type="button" variant="quiet" disabled={pending} onClick={onClose}>Kembali</Button></div></form>
  </dialog>;
}
