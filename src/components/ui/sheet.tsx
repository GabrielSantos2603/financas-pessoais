"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * Bottom-sheet no celular / modal no desktop, usando <dialog> nativo (foco, ESC e inércia de graça).
 * `top` substitui o cabeçalho padrão (usado pelo formulário colorido de lançamento).
 */
export function Sheet({
  open, onClose, title, children, footer, top, width = "32rem",
}: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; top?: React.ReactNode; width?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      style={{ ["--sheet-w" as string]: width }}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      aria-label={title}
    >
      {open && (
        <div className="flex max-h-[94dvh] flex-col">
          {top ?? (
            <>
              <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-border md:hidden" />
              <header className="flex items-center justify-between px-5 pb-2 pt-3">
                <h2 className="text-lg font-bold tracking-tight">{title}</h2>
                <button onClick={onClose} aria-label="Fechar" className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2">
                  <X className="size-5" />
                </button>
              </header>
            </>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 pt-1">{children}</div>
          {footer && <footer className="safe-bottom border-t border-border bg-surface px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
