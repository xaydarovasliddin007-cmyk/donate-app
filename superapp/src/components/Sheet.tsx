import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { telegram } from '../services/telegram';

export function Sheet({ title, onClose, children, busy = false }: { title: string; onClose: () => void; children: ReactNode; busy?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const el = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    el.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { el.close(); document.body.style.overflow = previousOverflow; previous?.focus(); };
  }, []);
  useEffect(() => {
    const button = telegram()?.BackButton;
    const back = () => { if (!busy) close.current(); };
    button?.show(); button?.onClick(back);
    return () => { button?.offClick(back); button?.hide(); };
  }, [busy]);
  return <dialog ref={dialog} className="sheet" aria-label={title}
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget && !busy) {
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    } }}>
    <header className="sheet-header"><h2>{title}</h2><button className="icon-button" title="Yopish" aria-label="Yopish" disabled={busy} onClick={onClose}><X size={21}/></button></header>
    {children}
  </dialog>;
}
