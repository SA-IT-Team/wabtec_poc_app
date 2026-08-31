import { useCallback, useEffect, useState } from "react";
import { ApiClientError, exportDrawing, getReconciliation, reviewBalloon, signOff } from "../lib/api";
import { DEFAULT_TEMPLATE_ID, EXPORT_TEMPLATES } from "../lib/templates";
import type { BalloonReviewRecord, ConnectionConfig, ExtractedBalloon, ReconciliationRecord } from "../lib/types";
import { StatusPill } from "./StatusPill";
import "./ReconciliationPanel.css";

interface ReconciliationPanelProps {
  jobId: string;
  config: ConnectionConfig | null;
  identity: string;
  onIdentityChange: (name: string) => void;
}

type OpenForm = { key: string; kind: "correct" | "cannotDetermine" } | null;

function balloonKey(page: number, balloonNumber: number): string {
  return `${page}-${balloonNumber}`;
}

function describeError(err: unknown): string {
  if (err instanceof ApiClientError) {
    const openList = err.body?.openBalloons?.map((b) => `#${b.balloonNumber} (p.${b.page})`).join(", ");
    return openList ? `${err.message} Open: ${openList}.` : err.message;
  }
  if (err instanceof Error) return err.message;
  return "An unknown error occurred.";
}

export function ReconciliationPanel({ jobId, config, identity, onIdentityChange }: ReconciliationPanelProps) {
  const [record, setRecord] = useState<ReconciliationRecord | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [openForm, setOpenForm] = useState<OpenForm>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  // null until the reviewer explicitly picks a different one -- exportDrawing then falls back to
  // whatever template was chosen at upload (see api.ts / wabtec_poc/src/excel_templates.py).
  const [templateChoice, setTemplateChoice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await getReconciliation(config, jobId);
      setRecord(next);
      setLoadError(null);
    } catch (err) {
      setLoadError(describeError(err));
    }
  }, [config, jobId]);

  useEffect(() => {
    setRecord(null);
    setExportUrl(null);
    setOpenForm(null);
    void load();
  }, [load]);

  async function handleReview(
    balloon: BalloonReviewRecord,
    action: "confirm" | "correct" | "cannot_determine",
    extra: { correctedValue?: ExtractedBalloon; notes?: string } = {}
  ) {
    const key = balloonKey(balloon.page, balloon.balloon_number);
    setBusyKey(key);
    setActionError(null);
    try {
      await reviewBalloon(config, jobId, balloon.page, balloon.balloon_number, identity, action, extra);
      setOpenForm(null);
      await load();
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSignOff() {
    setBusyKey("__signoff__");
    setActionError(null);
    try {
      await signOff(config, jobId, identity);
      await load();
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleExport() {
    setBusyKey("__export__");
    setActionError(null);
    try {
      const result = await exportDrawing(config, jobId, { templateId: templateChoice ?? undefined });
      setExportUrl(result.exportUrl);
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setBusyKey(null);
    }
  }

  if (loadError) {
    return (
      <div className="reconciliation-panel reconciliation-panel--error" role="alert">
        Couldn't load reconciliation state: {loadError}
      </div>
    );
  }

  if (!record) {
    return (
      <div className="reconciliation-panel" role="status">
        Loading reconciliation state…
      </div>
    );
  }

  const total = record.balloons.length;
  const reconciled = record.balloons.filter((b) => b.status === "reconciled").length;
  const readyForSignoff = total > 0 && reconciled === total;
  const identityIsSubmitter = Boolean(record.submitted_by) && identity.trim() === record.submitted_by?.trim();
  const effectiveTemplateId = templateChoice ?? record.template_id ?? DEFAULT_TEMPLATE_ID;

  return (
    <section className="reconciliation-panel">
      <div className="reconciliation-panel__head">
        <div>
          <h3>Reconciliation</h3>
          <p className="reconciliation-panel__subtitle">
            Every balloon needs a human review before this drawing can be exported — automated extraction alone can't
            guarantee accuracy.
          </p>
        </div>
        <div className="reconciliation-panel__progress">
          <span className="reconciliation-panel__progress-count">
            {reconciled} / {total} reconciled
          </span>
          {record.signed_off ? (
            <StatusPill tone="good">✓ signed off by {record.signed_off_by}</StatusPill>
          ) : readyForSignoff ? (
            <StatusPill tone="warn">ready to sign off</StatusPill>
          ) : (
            <StatusPill tone="neutral">in progress</StatusPill>
          )}
        </div>
      </div>

      <div className="reconciliation-panel__identity">
        <label htmlFor="identity">Reviewing / signing as</label>
        <input
          id="identity"
          type="text"
          value={identity}
          onChange={(e) => onIdentityChange(e.target.value)}
          placeholder="your name"
        />
        {record.submitted_by && (
          <span className="reconciliation-panel__submitter">
            submitted by <code>{record.submitted_by}</code>
            {identityIsSubmitter && " — you can't also review your own submission"}
          </span>
        )}
      </div>

      {actionError && (
        <div className="reconciliation-panel__error" role="alert">
          {actionError}
        </div>
      )}

      <div className="reconciliation-panel__wrap">
        <table className="reconciliation-panel__table">
          <thead>
            <tr>
              <th>Balloon</th>
              <th>Extracted</th>
              <th>Status</th>
              <th>Reviewed</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {[...record.balloons]
              .sort((a, b) => a.page - b.page || a.balloon_number - b.balloon_number)
              .map((balloon) => {
                const key = balloonKey(balloon.page, balloon.balloon_number);
                const isBusy = busyKey === key;
                const locked = record.signed_off;
                return (
                  <BalloonReviewRow
                    key={key}
                    balloon={balloon}
                    busy={isBusy}
                    locked={locked}
                    formOpen={openForm?.key === key ? openForm.kind : null}
                    onConfirm={() => handleReview(balloon, "confirm")}
                    onOpenCorrect={() => setOpenForm({ key, kind: "correct" })}
                    onOpenCannotDetermine={() => setOpenForm({ key, kind: "cannotDetermine" })}
                    onCancelForm={() => setOpenForm(null)}
                    onSubmitCorrect={(correctedValue, notes) => handleReview(balloon, "correct", { correctedValue, notes })}
                    onSubmitCannotDetermine={(notes) => handleReview(balloon, "cannot_determine", { notes })}
                  />
                );
              })}
          </tbody>
        </table>
      </div>

      <div className="reconciliation-panel__footer">
        {!record.signed_off && (
          <button
            type="button"
            className="btn btn--primary"
            disabled={!readyForSignoff || busyKey === "__signoff__" || !identity.trim()}
            onClick={handleSignOff}
          >
            {busyKey === "__signoff__" ? "Signing off…" : "Sign off"}
          </button>
        )}
        {record.signed_off && !exportUrl && (
          <div className="reconciliation-panel__export">
            <label className="reconciliation-panel__template">
              <span>Template</span>
              <select
                value={effectiveTemplateId}
                onChange={(e) => setTemplateChoice(e.target.value)}
                disabled={busyKey === "__export__"}
              >
                {EXPORT_TEMPLATES.map((t) => (
                  <option key={t.templateId} value={t.templateId}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn--primary" disabled={busyKey === "__export__"} onClick={handleExport}>
              {busyKey === "__export__" ? "Generating export…" : "Export Excel"}
            </button>
          </div>
        )}
        {exportUrl && (
          <a className="btn btn--primary" href={exportUrl} target="_blank" rel="noreferrer">
            Download Excel export
          </a>
        )}
        {!record.signed_off && !readyForSignoff && (
          <span className="reconciliation-panel__hint">Review every balloon to enable sign-off.</span>
        )}
      </div>
    </section>
  );
}

interface BalloonReviewRowProps {
  balloon: BalloonReviewRecord;
  busy: boolean;
  locked: boolean;
  formOpen: "correct" | "cannotDetermine" | null;
  onConfirm: () => void;
  onOpenCorrect: () => void;
  onOpenCannotDetermine: () => void;
  onCancelForm: () => void;
  onSubmitCorrect: (correctedValue: ExtractedBalloon, notes?: string) => void;
  onSubmitCannotDetermine: (notes: string) => void;
}

function BalloonReviewRow({
  balloon,
  busy,
  locked,
  formOpen,
  onConfirm,
  onOpenCorrect,
  onOpenCannotDetermine,
  onCancelForm,
  onSubmitCorrect,
  onSubmitCannotDetermine,
}: BalloonReviewRowProps) {
  const [nominalValue, setNominalValue] = useState(String(balloon.extracted.nominal_value ?? ""));
  const [unit, setUnit] = useState(balloon.extracted.unit ?? "");
  const [upperTol, setUpperTol] = useState(String(balloon.extracted.upper_tol ?? ""));
  const [lowerTol, setLowerTol] = useState(String(balloon.extracted.lower_tol ?? ""));
  const [correctionNotes, setCorrectionNotes] = useState("");
  const [cannotDetermineNotes, setCannotDetermineNotes] = useState("");

  const shown = balloon.reviewed ?? balloon.extracted;

  function submitCorrection(e: React.FormEvent) {
    e.preventDefault();
    const correctedValue: ExtractedBalloon = {
      ...balloon.extracted,
      nominal_value: nominalValue.trim() === "" ? null : Number(nominalValue),
      unit: unit.trim() || null,
      upper_tol: upperTol.trim() === "" ? null : Number(upperTol),
      lower_tol: lowerTol.trim() === "" ? null : Number(lowerTol),
    };
    onSubmitCorrect(correctedValue, correctionNotes.trim() || undefined);
  }

  function submitCannotDetermine(e: React.FormEvent) {
    e.preventDefault();
    if (!cannotDetermineNotes.trim()) return;
    onSubmitCannotDetermine(cannotDetermineNotes.trim());
  }

  return (
    <>
      <tr className={balloon.discrepancy ? "reconciliation-panel__row--discrepancy" : ""}>
        <td>
          <span className="reconciliation-panel__badge">{balloon.balloon_number}</span>
          <span className="reconciliation-panel__page">p.{balloon.page}</span>
        </td>
        <td className="reconciliation-panel__mono">
          {balloon.extracted.nominal_value ?? "—"} {balloon.extracted.unit ?? ""}
          {balloon.extracted.gdt && ` · ${balloon.extracted.gdt.symbol} ${balloon.extracted.gdt.value}`}
        </td>
        <td>
          <StatusTag status={balloon.status} discrepancy={balloon.discrepancy} />
        </td>
        <td className="reconciliation-panel__mono">
          {balloon.status === "cannot_determine"
            ? balloon.notes ?? "—"
            : balloon.reviewed
              ? `${shown.nominal_value ?? "—"} ${shown.unit ?? ""}`
              : "—"}
          {balloon.reviewer_id && <span className="reconciliation-panel__reviewer"> — {balloon.reviewer_id}</span>}
        </td>
        <td>
          {locked ? (
            <span className="reconciliation-panel__locked">locked</span>
          ) : formOpen ? (
            <button type="button" className="btn btn--ghost btn--small" onClick={onCancelForm}>
              Cancel
            </button>
          ) : (
            <div className="reconciliation-panel__actions">
              <button type="button" className="btn btn--small btn--primary" disabled={busy} onClick={onConfirm}>
                Confirm
              </button>
              <button type="button" className="btn btn--small btn--ghost" disabled={busy} onClick={onOpenCorrect}>
                Correct
              </button>
              <button type="button" className="btn btn--small btn--ghost" disabled={busy} onClick={onOpenCannotDetermine}>
                Can't determine
              </button>
            </div>
          )}
        </td>
      </tr>
      {formOpen === "correct" && (
        <tr className="reconciliation-panel__form-row">
          <td colSpan={5}>
            <form className="reconciliation-panel__form" onSubmit={submitCorrection}>
              <label>
                Nominal
                <input type="number" step="any" value={nominalValue} onChange={(e) => setNominalValue(e.target.value)} />
              </label>
              <label>
                Unit
                <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)} />
              </label>
              <label>
                Upper tol
                <input type="number" step="any" value={upperTol} onChange={(e) => setUpperTol(e.target.value)} />
              </label>
              <label>
                Lower tol
                <input type="number" step="any" value={lowerTol} onChange={(e) => setLowerTol(e.target.value)} />
              </label>
              <label className="reconciliation-panel__form-notes">
                Notes (optional)
                <input type="text" value={correctionNotes} onChange={(e) => setCorrectionNotes(e.target.value)} />
              </label>
              <button type="submit" className="btn btn--primary btn--small" disabled={busy}>
                Submit correction
              </button>
            </form>
          </td>
        </tr>
      )}
      {formOpen === "cannotDetermine" && (
        <tr className="reconciliation-panel__form-row">
          <td colSpan={5}>
            <form className="reconciliation-panel__form" onSubmit={submitCannotDetermine}>
              <label className="reconciliation-panel__form-notes">
                Why can't this be determined from the source? (required)
                <input
                  type="text"
                  value={cannotDetermineNotes}
                  onChange={(e) => setCannotDetermineNotes(e.target.value)}
                  placeholder="e.g. smudged ink, illegible scan"
                  required
                />
              </label>
              <button type="submit" className="btn btn--primary btn--small" disabled={busy || !cannotDetermineNotes.trim()}>
                Flag
              </button>
            </form>
          </td>
        </tr>
      )}
    </>
  );
}

function StatusTag({ status, discrepancy }: { status: BalloonReviewRecord["status"]; discrepancy: boolean }) {
  if (status === "pending") return <StatusPill tone="neutral">pending</StatusPill>;
  if (status === "cannot_determine") return <StatusPill tone="warn">can't determine</StatusPill>;
  return <StatusPill tone="good">{discrepancy ? "reconciled (corrected)" : "reconciled"}</StatusPill>;
}
