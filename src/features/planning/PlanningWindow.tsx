import { useEffect, useRef, type ReactNode } from 'react';

export default function PlanningWindow({ title, subtitle, children, onClose, side, closing = false }: {
  title: string; subtitle: string; children: ReactNode; onClose: () => void; side: 'left' | 'right'; closing?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    node.showModal();
    return () => { node.close(); previous?.focus(); };
  }, []);
  return (
    <dialog ref={dialog} aria-label={title} className="sp-planning-window" data-side={side} data-closing={closing}
      onClick={event => {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right)) onClose();
      }}
      onCancel={event => { event.preventDefault(); onClose(); }}>
      <header className="sp-planning-window-heading">
        <div><h2>{title}</h2><p>{subtitle}</p></div>
        <button className="sp-planning-close" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`}>×</button>
      </header>
      {children}
    </dialog>
  );
}
