'use client';

import { useRef, useState } from 'react';
import { Sparkles, X } from 'lucide-react';

import { ReuseIdeas as ReuseForm } from './reuse-form';
import styles from './reuse-widget.module.css';

export function ReuseIdeas() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  function openPanel() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;

    dialog.showModal();
    setIsOpen(true);
  }

  function closePanel() {
    dialogRef.current?.close();
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={styles.launcher}
        onClick={openPanel}
        aria-label="Tanya AI Valora tentang barang bekas"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls="valora-ai-panel"
        title="Tanya AI Valora"
      >
        <Sparkles size={21} strokeWidth={1.8} aria-hidden="true" />
        <span className={styles.launcherLabel} aria-hidden="true">
          AI
        </span>
      </button>

      <dialog
        ref={dialogRef}
        id="valora-ai-panel"
        className={styles.panel}
        aria-labelledby="valora-ai-title"
        onClose={() => {
          setIsOpen(false);
          buttonRef.current?.focus({ preventScroll: true });
        }}
        onClick={event => {
          if (event.target !== event.currentTarget) return;

          const bounds = event.currentTarget.getBoundingClientRect();
          const outside =
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom;

          if (outside) closePanel();
        }}
      >
        <div className={styles.header}>
          <div className={styles.identity}>
            <span className={styles.headerIcon} aria-hidden="true">
              <Sparkles size={19} strokeWidth={1.8} />
            </span>

            <h2 id="valora-ai-title" className={styles.title}>
              Asisten AI Valora
            </h2>
          </div>

          <button
            type="button"
            className={styles.closeButton}
            onClick={closePanel}
            aria-label="Tutup asisten AI"
            title="Tutup"
            autoFocus
          >
            <X size={21} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.content}>
          <ReuseForm />
        </div>
      </dialog>
    </>
  );
}