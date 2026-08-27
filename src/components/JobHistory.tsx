import type { HistoryEntry } from "../lib/types";
import { StatusPill } from "./StatusPill";
import "./JobHistory.css";

interface JobHistoryProps {
  entries: HistoryEntry[];
  activeJobId: string | null;
  onSelect: (jobId: string) => void;
  onClear: () => void;
}

export function JobHistory({ entries, activeJobId, onSelect, onClear }: JobHistoryProps) {
  return (
    <div className="job-history">
      <div className="job-history__head">
        <span className="job-history__title">Recent jobs</span>
        {entries.length > 0 && (
          <button type="button" className="btn btn--ghost btn--small" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      {entries.length === 0 ? (
        <p className="job-history__empty">Nothing extracted yet in this browser.</p>
      ) : (
        <ul className="job-history__list">
          {entries.map((entry) => (
            <li key={entry.jobId}>
              <button
                type="button"
                className={`job-history__item${entry.jobId === activeJobId ? " job-history__item--active" : ""}`}
                onClick={() => onSelect(entry.jobId)}
              >
                <span className="job-history__filename">{entry.fileName}</span>
                <span className="job-history__meta">
                  {entry.drawingNumber ?? "unparsed"} · {new Date(entry.submittedAt).toLocaleTimeString()}
                </span>
                {entry.balloonCountMismatch === true && <StatusPill tone="warn">mismatch</StatusPill>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
