import { useCallback, useState } from "react";
import { ApiClientError, analyzeDrawing, chatWithDrawing } from "../lib/api";
import type { AnalysisFinding, AnalysisReport, ChatTurn, ConnectionConfig } from "../lib/types";
import { StatusPill, type PillTone } from "./StatusPill";
import "./AssistantPanel.css";

interface AssistantPanelProps {
  jobId: string;
  config: ConnectionConfig | null;
}

type Tab = "feedback" | "chat";

const CATEGORY_LABELS: Record<AnalysisFinding["category"], string> = {
  missing_info: "Missing information",
  incomplete_data: "Incomplete data",
  inconsistency: "Inconsistency",
  common_mistake: "Common mistake",
};

function severityTone(severity: AnalysisFinding["severity"]): PillTone {
  if (severity === "critical") return "bad";
  if (severity === "info") return "neutral";
  return "warn";
}

function describeError(err: unknown): string {
  if (err instanceof ApiClientError) {
    return `${err.message} (HTTP ${err.status}${err.body?.error ? `, ${err.body.error}` : ""})`;
  }
  if (err instanceof Error) return err.message;
  return "An unknown error occurred.";
}

export function AssistantPanel({ jobId, config }: AssistantPanelProps) {
  const [tab, setTab] = useState<Tab>("feedback");

  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const runAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      setReport(await analyzeDrawing(config, jobId));
    } catch (err) {
      setAnalyzeError(describeError(err));
    } finally {
      setAnalyzing(false);
    }
  }, [config, jobId]);

  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const message = draft.trim();
      if (!message || sending) return;

      const history = turns; // prior turns only -- the new message is sent separately, see api.ts
      setTurns((prev) => [...prev, { role: "user", content: message }]);
      setDraft("");
      setSending(true);
      setChatError(null);
      try {
        const reply = await chatWithDrawing(config, jobId, message, history);
        setTurns((prev) => [...prev, { role: "assistant", content: reply }]);
      } catch (err) {
        setChatError(describeError(err));
      } finally {
        setSending(false);
      }
    },
    [config, jobId, draft, turns, sending]
  );

  return (
    <section className="assistant-panel">
      <div className="assistant-panel__head">
        <div>
          <h3>AI Assistant</h3>
          <p className="assistant-panel__subtitle">
            General analysis and feedback on this drawing's data — missing information, incomplete
            data, inconsistencies between sheets, and common mistakes. An assistant, not a source of
            truth: verify anything it flags against the drawing yourself.
          </p>
        </div>
        <div className="assistant-panel__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "feedback"}
            className={`assistant-panel__tab${tab === "feedback" ? " assistant-panel__tab--active" : ""}`}
            onClick={() => setTab("feedback")}
          >
            Feedback
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "chat"}
            className={`assistant-panel__tab${tab === "chat" ? " assistant-panel__tab--active" : ""}`}
            onClick={() => setTab("chat")}
          >
            Ask a question
          </button>
        </div>
      </div>

      {tab === "feedback" && (
        <div className="assistant-panel__feedback">
          <button type="button" className="btn btn--primary btn--small" disabled={analyzing} onClick={runAnalysis}>
            {analyzing ? "Analyzing…" : report ? "Re-run analysis" : "Run analysis"}
          </button>

          {analyzeError && (
            <div className="assistant-panel__error" role="alert">
              {analyzeError}
            </div>
          )}

          {!report && !analyzing && !analyzeError && (
            <p className="assistant-panel__empty">
              Run a check for missing information, incomplete data, cross-sheet inconsistencies, and
              common mistakes across every balloon on this drawing.
            </p>
          )}

          {report && (
            <div className="assistant-panel__report">
              <p className="assistant-panel__summary">{report.summary}</p>
              {report.findings.length === 0 ? (
                <p className="assistant-panel__empty">No findings — looks clean.</p>
              ) : (
                <ul className="assistant-panel__findings">
                  {report.findings.map((f, i) => (
                    <li key={i} className="assistant-panel__finding">
                      <div className="assistant-panel__finding-head">
                        <StatusPill tone={severityTone(f.severity)}>{f.severity}</StatusPill>
                        <span className="assistant-panel__finding-category">{CATEGORY_LABELS[f.category]}</span>
                        <span
                          className="assistant-panel__finding-source"
                          title={f.source === "ai" ? "Added or confirmed by the AI review pass" : "Deterministic automated check, no AI call"}
                        >
                          {f.source === "ai" ? "✨ AI" : "✓ rule"}
                        </span>
                      </div>
                      <p className="assistant-panel__finding-summary">{f.summary}</p>
                      <p className="assistant-panel__finding-detail">{f.detail}</p>
                      {f.balloon_refs.length > 0 && (
                        <p className="assistant-panel__finding-refs">
                          {f.balloon_refs.map((r) => `#${r.balloon_number} (p.${r.page})`).join(", ")}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "chat" && (
        <div className="assistant-panel__chat">
          <div className="assistant-panel__transcript" role="log">
            {turns.length === 0 && (
              <p className="assistant-panel__empty">
                Ask anything about this drawing's data — counts, values, tolerances, GD&amp;T, review
                status.
              </p>
            )}
            {turns.map((t, i) => (
              <div key={i} className={`assistant-panel__bubble assistant-panel__bubble--${t.role}`}>
                {t.content}
              </div>
            ))}
            {sending && (
              <div className="assistant-panel__bubble assistant-panel__bubble--assistant assistant-panel__bubble--pending" aria-live="polite">
                Thinking…
              </div>
            )}
          </div>

          {chatError && (
            <div className="assistant-panel__error" role="alert">
              {chatError}
            </div>
          )}

          <form className="assistant-panel__composer" onSubmit={sendMessage}>
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. Which balloons still need review?"
              disabled={sending}
              aria-label="Message"
            />
            <button type="submit" className="btn btn--primary btn--small" disabled={sending || !draft.trim()}>
              Send
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
