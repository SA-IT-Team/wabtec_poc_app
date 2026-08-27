import "./StatusPill.css";

export type PillTone = "neutral" | "good" | "warn" | "bad";

interface StatusPillProps {
  tone: PillTone;
  children: React.ReactNode;
}

export function StatusPill({ tone, children }: StatusPillProps) {
  return <span className={`status-pill status-pill--${tone}`}>{children}</span>;
}
