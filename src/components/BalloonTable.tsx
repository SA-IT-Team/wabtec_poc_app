import { Fragment, useState } from "react";
import type { ExtractedBalloon } from "../lib/types";
import "./BalloonTable.css";

const LOW_CONFIDENCE_THRESHOLD = 0.7;

interface BalloonTableProps {
  balloons: ExtractedBalloon[];
}

function formatTolerance(b: ExtractedBalloon): string {
  if (b.upper_tol == null && b.lower_tol == null) return "—";
  const upper = b.upper_tol != null ? `+${b.upper_tol}` : "";
  const lower = b.lower_tol != null ? `${b.lower_tol}` : "";
  return [upper, lower].filter(Boolean).join(" / ") || "—";
}

function formatGdt(b: ExtractedBalloon): string {
  if (!b.gdt) return "—";
  const modifiers = b.gdt.modifiers.length ? ` (${b.gdt.modifiers.join(", ")})` : "";
  const datums = b.gdt.datums.length ? ` | ${b.gdt.datums.join("-")}` : "";
  return `${b.gdt.symbol} ${b.gdt.value}${modifiers}${datums}`;
}

function rowKey(b: ExtractedBalloon): string {
  return `${b.page}-${b.balloon_number}`;
}

const COLUMNS = 7;

/** Every row stays one line tall: notes, the model's confidence reasoning, and any extraction
 * error live in an expandable detail row under it (always in the DOM, just hidden), rather than a
 * Notes column whose wrapped text made each row several lines tall and got clipped at half width. */
export function BalloonTable({ balloons }: BalloonTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  if (balloons.length === 0) {
    return <p className="balloon-table__empty">No balloons in this result.</p>;
  }

  const sorted = [...balloons].sort((a, b) => a.balloon_number - b.balloon_number);
  const withDetails = sorted.filter((b) => b.notes || b.confidence_reason || b.extraction_error);
  const lowCount = sorted.filter((b) => b.confidence < LOW_CONFIDENCE_THRESHOLD).length;
  const allOpen = withDetails.length > 0 && withDetails.every((b) => expanded.has(rowKey(b)));

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    setExpanded(allOpen ? new Set() : new Set(withDetails.map(rowKey)));
  }

  return (
    <section className="balloon-table__card">
      <div className="balloon-table__head">
        <h3>Extracted values</h3>
        <span className="balloon-table__meta">
          {sorted.length} rows
          {lowCount > 0 && <span className="balloon-table__meta-warn"> · {lowCount} low confidence</span>}
        </span>
        {withDetails.length > 0 && (
          <button type="button" className="btn btn--ghost btn--small balloon-table__toggle-all" onClick={toggleAll}>
            {allOpen ? "Hide notes" : "Show all notes"}
          </button>
        )}
      </div>

      <div className="balloon-table__wrap">
        <table className="balloon-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Pg</th>
              <th>Nominal</th>
              <th>Tolerance</th>
              <th>GD&amp;T</th>
              <th>Conf.</th>
              <th aria-label="Notes" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((b) => {
              const key = rowKey(b);
              const lowConfidence = b.confidence < LOW_CONFIDENCE_THRESHOLD;
              const hasDetails = Boolean(b.notes || b.confidence_reason || b.extraction_error);
              const isOpen = expanded.has(key);
              return (
                <Fragment key={key}>
                  <tr className={lowConfidence ? "balloon-table__row--low-confidence" : ""}>
                    <td>
                      <span className="balloon-table__badge">{b.balloon_number}</span>
                    </td>
                    <td>{b.page}</td>
                    <td className="balloon-table__nowrap">
                      {b.nominal_value ?? "—"}
                      {b.unit && <span className="balloon-table__unit"> {b.unit}</span>}
                    </td>
                    <td className="balloon-table__nowrap">{formatTolerance(b)}</td>
                    <td className="balloon-table__mono">{formatGdt(b)}</td>
                    <td>
                      <span className={`balloon-table__confidence${lowConfidence ? " balloon-table__confidence--low" : ""}`}>
                        {(b.confidence * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="balloon-table__expand-cell">
                      {hasDetails && (
                        <button
                          type="button"
                          className={`balloon-table__expand${b.extraction_error ? " balloon-table__expand--error" : ""}`}
                          aria-expanded={isOpen}
                          aria-label={`${isOpen ? "Hide" : "Show"} notes for balloon ${b.balloon_number}`}
                          title={isOpen ? "Hide notes" : "Show notes"}
                          onClick={() => toggle(key)}
                        >
                          {isOpen ? "▾" : "▸"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {hasDetails && (
                    <tr className="balloon-table__detail" hidden={!isOpen}>
                      <td colSpan={COLUMNS}>
                        <div className="balloon-table__notes">
                          {b.notes && <div>{b.notes}</div>}
                          {b.confidence_reason && <div className="balloon-table__confidence-reason">{b.confidence_reason}</div>}
                          {b.extraction_error && <div className="balloon-table__error">{b.extraction_error}</div>}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
