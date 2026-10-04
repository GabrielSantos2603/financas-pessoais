"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/** Bottom-sheet no mobile / modal no desktop, usando <dialog> nativo (foco e ESC de graça). */
export function Sheet({
  open, onClose, title, children, footer, width = "32rem",
}: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; width?: string;
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
        <div className="flex max-h-[92dvh] flex-col">
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border md:hidden" />
          <header className="flex items-center justify-between px-5 pb-2 pt-3">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button onClick={onClose} aria-label="Fechar" className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2">
              <X className="size-5" />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
          {footer && <footer className="safe-bottom border-t border-border bg-surface px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
