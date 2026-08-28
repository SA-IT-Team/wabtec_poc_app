import { useState, type ReactNode } from "react";
import "./CollapsiblePanel.css";

interface CollapsiblePanelProps {
  title: string;
  subtitle?: string;
  /** Distinguishes this panel's remembered open/closed state in localStorage -- unique per panel
   * (e.g. "recent-jobs", "ai-assistant"). */
  storageKey: string;
  defaultOpen?: boolean;
  /** Caps the body's height and lets it scroll internally instead of growing indefinitely -- for
   * panels whose content can get arbitrarily long (e.g. AI Assistant's findings list/chat). */
  scrollable?: boolean;
  children: ReactNode;
}

const STORAGE_PREFIX = "bdx-poc.panel.";

function loadOpen(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw === null ? fallback : raw === "open";
  } catch {
    return fallback; // localStorage unavailable (private browsing, etc.) -- just don't persist
  }
}

function saveOpen(key: string, open: boolean): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, open ? "open" : "closed");
  } catch {
    // not persisting is fine -- the panel still works for this session
  }
}

/** A collapsible card: click the header to toggle, remembered per-panel across reloads. Used to
 * let the sidebar hold both Recent Jobs and the AI Assistant without either one crowding the
 * other out -- see App.tsx. */
export function CollapsiblePanel({
  title,
  subtitle,
  storageKey,
  defaultOpen = true,
  scrollable = false,
  children,
}: CollapsiblePanelProps) {
  const [open, setOpen] = useState(() => loadOpen(storageKey, defaultOpen));

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      saveOpen(storageKey, next);
      return next;
    });
  }

  return (
    <section className={`collapsible-panel${open ? "" : " collapsible-panel--collapsed"}`}>
      <button type="button" className="collapsible-panel__header" onClick={toggle} aria-expanded={open}>
        <span className="collapsible-panel__chevron" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
        <span className="collapsible-panel__title-block">
          <span className="collapsible-panel__title">{title}</span>
          {subtitle && <span className="collapsible-panel__subtitle">{subtitle}</span>}
        </span>
      </button>
      {open && (
        <div className={`collapsible-panel__body${scrollable ? " collapsible-panel__body--scrollable" : ""}`}>
          {children}
        </div>
      )}
    </section>
  );
}
