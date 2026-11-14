'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, X } from 'lucide-react';

import { ReuseIdeas as ReuseForm } from './reuse-form';

const HINT_STORAGE_KEY = 'valora-ai-hint-dismissed';

export function AiLauncher() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const [showHint, setShowHint] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      setShowHint(sessionStorage.getItem(HINT_STORAGE_KEY) !== '1');
    } catch {
      setShowHint(true);
    }
  }, []);

  function dismissHint() {
    setShowHint(false);

    try {
      sessionStorage.setItem(HINT_STORAGE_KEY, '1');
    } catch {
      // State React tetap menyimpan pilihan selama halaman terbuka.
    }
  }

  function openChat() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;

    dismissHint();
    dialog.showModal();
    setIsOpen(true);
  }

  function closeChat() {
    dialogRef.current?.close();
  }

  return (
    <>
      <div className="ai-dock">
        {showHint && !isOpen && (
          <div className="ai-hint">
            <button
              type="button"
              className="ai-hint-message"
              onClick={openChat}
              aria-label="Buka AI Valora untuk mencari ide barang bekas"
            >
              <strong>Aku AI Valora.</strong>
              <span>Tanya ide barang bekasmu!</span>
            </button>

            <button
              type="button"
              className="ai-hint-close"
              aria-label="Sembunyikan petunjuk AI"
              onClick={() => {
                dismissHint();
                buttonRef.current?.focus({ preventScroll: true });
              }}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )}

        <button
          ref={buttonRef}
          type="button"
          className="ai-robot-button"
          aria-label="Buka chat dengan AI Valora"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls="valora-ai-dialog"
          title="Tanya AI Valora"
          onClick={openChat}
        >
          <Bot size={31} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>

      <dialog
        ref={dialogRef}
        id="valora-ai-dialog"
        className="ai-dialog"
        aria-labelledby="valora-ai-heading"
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

          if (outside) closeChat();
        }}
      >
        <header className="ai-header">
          <div className="ai-identity">
            <span className="ai-header-robot" aria-hidden="true">
              <Bot size={26} strokeWidth={1.8} />
            </span>

            <h2 id="valora-ai-heading">Asisten AI Valora</h2>
          </div>

          <button
            type="button"
            className="ai-close"
            aria-label="Tutup chat Valora"
            title="Tutup chat"
            onClick={closeChat}
            autoFocus
          >
            <X size={22} aria-hidden="true" />
          </button>
        </header>

        <div className="ai-body">
          <ReuseForm />
        </div>
      </dialog>

      <style jsx>{`
        .ai-dock {
          position: fixed;
          right: max(24px, env(safe-area-inset-right));
          bottom: max(24px, env(safe-area-inset-bottom));
          z-index: 41;
          display: flex;
          align-items: center;
          gap: 12px;
          max-width: calc(100vw - 40px);
        }

        /* Pada desktop, robot berada tepat di atas tombol Pesan. */
        @media (min-width: 1200px) {
          :global(body:has(.chat-launcher)) .ai-dock {
            bottom: calc(max(24px, env(safe-area-inset-bottom)) + 68px);
          }
        }

        /* Valora menaruh tombol Pesan di navbar pada perangkat sentuh. */
        @media (hover: none) and (pointer: coarse) {
          :global(body:has(.chat-launcher)) .ai-dock {
            bottom: max(24px, env(safe-area-inset-bottom));
          }
        }

        .ai-robot-button,
        .ai-hint-message,
        .ai-hint-close,
        .ai-close {
          font: inherit;
          cursor: pointer;
        }

        .ai-robot-button {
          display: grid;
          flex: 0 0 58px;
          place-items: center;
          width: 58px;
          height: 58px;
          padding: 0;
          border: 2px solid #d6edd5;
          border-radius: 20px;
          background: #23523b;
          color: #e8f7dc;
          box-shadow: 0 5px 16px rgb(27 66 43 / 22%);
        }

        .ai-hint {
          position: relative;
          display: flex;
          align-items: flex-start;
          max-width: 228px;
          border: 1px solid #c6d9c8;
          border-radius: 15px;
          background: #fff;
          box-shadow: 0 4px 16px rgb(29 59 39 / 12%);
        }

        .ai-hint::after {
          position: absolute;
          top: calc(50% - 5px);
          right: -6px;
          width: 10px;
          height: 10px;
          border-top: 1px solid #c6d9c8;
          border-right: 1px solid #c6d9c8;
          background: #fff;
          content: '';
          transform: rotate(45deg);
          pointer-events: none;
        }

        .ai-hint-message {
          display: grid;
          gap: 3px;
          padding: 11px 0 11px 14px;
          border: 0;
          border-radius: 14px;
          background: transparent;
          color: #244633;
          text-align: left;
        }

        .ai-hint-message strong {
          font-size: 14px;
          line-height: 1.3;
        }

        .ai-hint-message span {
          font-size: 13px;
          line-height: 1.4;
        }

        .ai-hint-close,
        .ai-close {
          display: grid;
          place-items: center;
          padding: 0;
          border: 0;
          border-radius: 50%;
          background: transparent;
          color: #41614b;
        }

        .ai-hint-close {
          width: 28px;
          height: 28px;
          margin: 3px 3px 0 2px;
        }

        .ai-close {
          width: 44px;
          height: 44px;
        }

        .ai-dialog {
          position: fixed;
          inset: auto max(20px, env(safe-area-inset-right))
            max(20px, env(safe-area-inset-bottom)) auto;
          box-sizing: border-box;
          width: min(620px, calc(100vw - 40px));
          height: min(720px, calc(100dvh - 40px));
          max-width: none;
          max-height: none;
          margin: 0;
          padding: 0;
          overflow: hidden;
          border: 1px solid #d3dfd3;
          border-radius: 22px;
          background: #f5f8f1;
          color: #20392b;
          box-shadow: 0 18px 60px rgb(19 44 29 / 24%);
        }

        .ai-dialog:not([open]) {
          display: none;
        }

        .ai-dialog[open] {
          display: flex;
          flex-direction: column;
        }

        .ai-dialog::backdrop {
          background: rgb(16 32 21 / 22%);
        }

        .ai-header,
        .ai-identity {
          display: flex;
          align-items: center;
        }

        .ai-header {
          flex: 0 0 auto;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 14px 12px 20px;
          border-bottom: 1px solid #dae5d8;
          background: #fff;
        }

        .ai-identity {
          gap: 11px;
        }

        .ai-header-robot {
          display: grid;
          width: 42px;
          height: 42px;
          place-items: center;
          border-radius: 14px;
          background: #23523b;
          color: #e8f7dc;
        }

        .ai-header h2 {
          margin: 0;
          color: #213d2d;
          font-size: 18px;
          line-height: 1.3;
        }

        .ai-body {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overscroll-behavior: contain;
          background: #f5f8f1;
        }

        /* Sesuaikan formulir yang sebelumnya ditata untuk beranda. */
        .ai-body :global(#tanya-ai) {
          margin: 0 !important;
          padding: clamp(20px, 3vw, 32px) !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
        }

        .ai-body :global(#reuse-ai-title) {
          font-size: clamp(22px, 2.5vw, 28px);
          line-height: 1.2;
        }

        .ai-body :global(#reuse-question) {
          min-height: 112px;
        }

        .ai-dock button:focus-visible,
        .ai-close:focus-visible {
          outline: 3px solid #669872;
          outline-offset: 3px;
        }

        @media (hover: hover) {
          .ai-robot-button:hover {
            background: #183f2c;
          }

          .ai-close:hover,
          .ai-hint-close:hover {
            background: #edf3eb;
          }
        }

        @media (max-width: 639px) {
          .ai-dock {
            right: max(16px, env(safe-area-inset-right));
            bottom: max(16px, env(safe-area-inset-bottom));
            gap: 10px;
          }

          .ai-dialog {
            inset: max(8px, env(safe-area-inset-top))
              max(8px, env(safe-area-inset-right))
              max(8px, env(safe-area-inset-bottom))
              max(8px, env(safe-area-inset-left));
            width: auto;
            height: auto;
            border-radius: 18px;
          }

          .ai-header {
            padding: 8px 10px 8px 14px;
          }
        }
      `}</style>
    </>
  );
}