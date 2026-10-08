import { useEffect, type ReactNode } from "react";
import "./Drawer.css";

interface DrawerProps {
  side: "left" | "right";
  title: string;
  icon?: ReactNode;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/** A slide-over panel with a dimmed backdrop (click it or press Escape to close). Stays mounted
 * while closed -- just moved off-screen and hidden from focus/assistive tech -- so content state
 * such as the AI assistant's chat transcript survives closing and reopening. */
export function Drawer({ side, title, icon, open, onClose, children }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div className={`drawer__backdrop${open ? " drawer__backdrop--open" : ""}`} onClick={onClose} aria-hidden="true" />
      <aside
        className={`drawer drawer--${side}${open ? " drawer--open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-hidden={!open}
      >
        <header className="drawer__header">
          {icon && <span className="drawer__icon" aria-hidden="true">{icon}</span>}
          <h2 className="drawer__title">{title}</h2>
          <button type="button" className="drawer__x" aria-label={`Close ${title}`} onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="drawer__body">{children}</div>
        <footer className="drawer__footer">
          <button type="button" className="btn btn--ghost drawer__close" onClick={onClose}>
            Close
          </button>
        </footer>
      </aside>
    </>
  );
}
