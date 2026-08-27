import type { ExtractionResult, JobRecord } from "../lib/types";
import { StatusPill } from "./StatusPill";
import "./ResultsSummary.css";

interface ResultsSummaryProps {
  result: ExtractionResult | JobRecord;
}

function isExtractionResult(r: ExtractionResult | JobRecord): r is ExtractionResult {
  return "balloons" in r;
}

export function ResultsSummary({ result }: ResultsSummaryProps) {
  const drawingNumber = result.drawing_number ?? "—";
  const revision = "revision" in result ? result.revision : null;
  const detected = isExtractionResult(result) ? result.balloon_count_detected : result.balloon_count_detected;
  const extracted = isExtractionResult(result) ? result.balloon_count_extracted : result.balloon_count_extracted;
  const mismatch = isExtractionResult(result) ? result.balloon_count_mismatch : detected !== extracted;

  return (
    <div className="results-summary">
      <div className="results-summary__row">
        <div className="results-summary__field">
          <span className="results-summary__label">Drawing</span>
          <span className="results-summary__value">{drawingNumber}</span>
        </div>
        <div className="results-summary__field">
          <span className="results-summary__label">Rev</span>
          <span className="results-summary__value">{revision ?? "—"}</span>
        </div>
        <div className="results-summary__field">
          <span className="results-summary__label">Detected</span>
          <span className="results-summary__value">{detected}</span>
        </div>
        <div className="results-summary__field">
          <span className="results-summary__label">Extracted</span>
          <span className="results-summary__value">{extracted}</span>
        </div>
        <div className="results-summary__field">
          <span className="results-summary__label">Job</span>
          <span className="results-summary__value results-summary__value--mono" title={result.job_id}>
            {result.job_id.slice(0, 8)}…
          </span>
        </div>
      </div>

      {mismatch ? (
        <StatusPill tone="warn">⚠ balloon count mismatch — {detected - extracted} not extracted</StatusPill>
      ) : (
        <StatusPill tone="good">✓ every detected balloon has a row</StatusPill>
      )}

      {isExtractionResult(result) && result.export_url && (
        <a className="btn btn--primary results-summary__export" href={result.export_url} target="_blank" rel="noreferrer">
          Download Excel export
        </a>
      )}
    </div>
  );
}
