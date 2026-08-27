import { useCallback, useEffect, useState } from "react";
import { ApiClientError, extractDrawing, getDrawingResult } from "./lib/api";
import { addHistoryEntry, clearConnectionConfig, clearHistory, loadConnectionConfig, loadHistory, saveConnectionConfig } from "./lib/storage";
import type { ConnectionConfig, ExtractionResult, HistoryEntry, JobRecord } from "./lib/types";
import { BalloonTable } from "./components/BalloonTable";
import { ConnectionBar } from "./components/ConnectionBar";
import { JobHistory } from "./components/JobHistory";
import { ResultsSummary } from "./components/ResultsSummary";
import { UploadPanel } from "./components/UploadPanel";
import "./App.css";

type ViewState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "result"; result: ExtractionResult | JobRecord }
  | { kind: "error"; message: string };

export default function App() {
  const [config, setConfig] = useState<ConnectionConfig | null>(() => loadConnectionConfig());
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [view, setView] = useState<ViewState>({ kind: "idle" });
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  useEffect(() => {
    document.title = config
      ? `Ballooned Drawing Extraction — ${new URL(config.baseUrl, window.location.href).host}`
      : "Ballooned Drawing Extraction — POC";
  }, [config]);

  const handleSaveConfig = useCallback((next: ConnectionConfig) => {
    setConfig(next);
    saveConnectionConfig(next);
  }, []);

  const handleClearConfig = useCallback(() => {
    setConfig(null);
    clearConnectionConfig();
  }, []);

  const handleUpload = useCallback(
    async (file: File, templateId: string) => {
      setView({ kind: "loading" });
      try {
        const result = await extractDrawing(config, file, { templateId });
        setActiveJobId(result.job_id);
        setView({ kind: "result", result });
        const nextHistory = addHistoryEntry({
          jobId: result.job_id,
          fileName: file.name,
          submittedAt: new Date().toISOString(),
          drawingNumber: result.drawing_number,
          balloonCountMismatch: result.balloon_count_mismatch,
        });
        setHistory(nextHistory);
      } catch (err) {
        setView({ kind: "error", message: describeError(err) });
      }
    },
    [config]
  );

  const handleSelectHistory = useCallback(
    async (jobId: string) => {
      setActiveJobId(jobId);
      setView({ kind: "loading" });
      try {
        const job = await getDrawingResult(config, jobId);
        setView({ kind: "result", result: job });
      } catch (err) {
        setView({ kind: "error", message: describeError(err) });
      }
    },
    [config]
  );

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
  }, []);

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__title-block">
          <span className="app__eyebrow">Proof of Concept</span>
          <h1>
            <span className="app__balloon">🎈</span> Ballooned Drawing Extraction
          </h1>
          <p className="app__subtitle">
            Upload a ballooned drawing to see what Document Intelligence + Azure OpenAI extract —
            no sign-off, no reconciliation, this is the accuracy spike (see architecture-poc.md).
          </p>
        </div>
        <ConnectionBar config={config} onSave={handleSaveConfig} onClear={handleClearConfig} />
      </header>

      <div className="app__layout">
        <aside className="app__sidebar">
          <JobHistory entries={history} activeJobId={activeJobId} onSelect={handleSelectHistory} onClear={handleClearHistory} />
        </aside>

        <main className="app__main">
          <UploadPanel disabled={!config} submitting={view.kind === "loading"} onSubmit={handleUpload} />

          {!config && <p className="app__hint">Configure your Function App URL and key above to get started.</p>}

          {view.kind === "error" && (
            <div className="app__error" role="alert">
              <strong>Extraction failed.</strong> {view.message}
            </div>
          )}

          {view.kind === "loading" && (
            <div className="app__loading" role="status">
              <span className="app__spinner" aria-hidden="true" />
              Processing — this can take up to a couple of minutes on a multi-page drawing.
            </div>
          )}

          {view.kind === "result" && (
            <section className="app__results">
              <ResultsSummary result={view.result} />
              {"balloons" in view.result && <BalloonTable balloons={view.result.balloons} />}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function describeError(err: unknown): string {
  if (err instanceof ApiClientError) {
    return `${err.message} (HTTP ${err.status}${err.body?.error ? `, ${err.body.error}` : ""})`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "An unknown error occurred.";
}
