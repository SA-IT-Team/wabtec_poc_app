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

export function BalloonTable({ balloons }: BalloonTableProps) {
  if (balloons.length === 0) {
    return <p className="balloon-table__empty">No balloons in this result.</p>;
  }

  const sorted = [...balloons].sort((a, b) => a.balloon_number - b.balloon_number);

  return (
    <div className="balloon-table__wrap">
      <table className="balloon-table">
        <thead>
          <tr>
            <th>Balloon</th>
            <th>Pg</th>
            <th>Nominal</th>
            <th>Unit</th>
            <th>Tolerance</th>
            <th>GD&amp;T</th>
            <th>Confidence</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((b) => {
            const lowConfidence = b.confidence < LOW_CONFIDENCE_THRESHOLD;
            return (
              <tr key={`${b.page}-${b.balloon_number}`} className={lowConfidence ? "balloon-table__row--low-confidence" : ""}>
                <td>
                  <span className="balloon-table__badge">{b.balloon_number}</span>
                </td>
                <td>{b.page}</td>
                <td>{b.nominal_value ?? "—"}</td>
                <td>{b.unit ?? "—"}</td>
                <td>{formatTolerance(b)}</td>
                <td className="balloon-table__mono">{formatGdt(b)}</td>
                <td>
                  <span className={`balloon-table__confidence${lowConfidence ? " balloon-table__confidence--low" : ""}`}>
                    {(b.confidence * 100).toFixed(0)}%
                  </span>
                </td>
                <td className="balloon-table__notes">
                  {b.extraction_error ? <span className="balloon-table__error">{b.extraction_error}</span> : b.notes ?? ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
