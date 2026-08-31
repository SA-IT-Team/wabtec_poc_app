import { useCallback, useEffect, useRef, useState } from "react";
import { ApiClientError, extractDrawingSmart, getDrawingResult, type UploadStage } from "./lib/api";
import { getEnvConnectionConfig } from "./lib/env";
import { addHistoryEntry, clearHistory, loadHistory, loadIdentity, saveIdentity } from "./lib/storage";
import type { ExtractionResult, HistoryEntry, JobRecord } from "./lib/types";
import { AssistantPanel } from "./components/AssistantPanel";
import { BalloonTable } from "./components/BalloonTable";
import { BrandLogo } from "./components/BrandLogo";
import { CollapsiblePanel } from "./components/CollapsiblePanel";
import { DrawingPreview } from "./components/DrawingPreview";
import { JobHistory } from "./components/JobHistory";
import { ReconciliationPanel } from "./components/ReconciliationPanel";
import { ResultsSummary } from "./components/ResultsSummary";
import { UploadPanel } from "./components/UploadPanel";
import "./App.css";

type ViewState =
  | { kind: "idle" }
  | { kind: "loading"; stage?: UploadStage }
  | { kind: "result"; result: ExtractionResult | JobRecord }
  | { kind: "error"; message: string };

/** The just-uploaded file, kept only as an object URL so the drawing itself can be shown
 * alongside its extraction/reconciliation results. Tagged with jobId so it's only rendered
 * while it actually matches the job on screen -- reopening a past job from history has no
 * local file to preview (the browser never re-downloads the original upload). */
type PreviewState = { jobId: string; url: string; name: string; type: string };

export default function App() {
  // Set once at build/deploy time via VITE_API_BASE_URL / VITE_API_ACCESS_KEY -- see lib/env.ts.
  // Not editable in the UI and not stored in component state: it can't change without a rebuild.
  const [config] = useState(() => getEnvConnectionConfig());
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [identity, setIdentity] = useState<string>(() => loadIdentity());
  const [view, setView] = useState<ViewState>({ kind: "idle" });
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    previewUrlRef.current = preview?.url ?? null;
  }, [preview]);

  // Revoke the last object URL on unmount so the browser can free the blob.
  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  useEffect(() => {
    document.title = config
      ? `Ballooned Drawing Extraction — ${new URL(config.baseUrl, window.location.href).host}`
      : "Ballooned Drawing Extraction — POC";
  }, [config]);

  const handleIdentityChange = useCallback((name: string) => {
    setIdentity(name);
    saveIdentity(name);
  }, []);

  const handleUpload = useCallback(
    async (file: File, templateId: string) => {
      setView({ kind: "loading" });
      try {
        const result = await extractDrawingSmart(config, file, {
          templateId,
          submittedBy: identity || undefined,
          onStageChange: (stage) => setView({ kind: "loading", stage }),
        });
        setActiveJobId(result.job_id);
        setView({ kind: "result", result });
        setPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return { jobId: result.job_id, url: URL.createObjectURL(file), name: file.name, type: file.type };
        });
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
    [config, identity]
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
        <div className="app__brand app__brand--left">
          <BrandLogo src="/logos/sa-technologies.svg" alt="SA Technologies" />
        </div>
        <div className="app__title-block">
          <span className="app__eyebrow">Proof of Concept</span>
          <h1>Ballooned Drawing Extraction</h1>
        </div>
        <div className="app__brand app__brand--right">
          <BrandLogo src="/logos/wabtec.svg" alt="Wabtec" />
        </div>
      </header>

      <div className="app__layout">
        <main className="app__main">
          <UploadPanel disabled={!config} submitting={view.kind === "loading"} onSubmit={handleUpload} />

          {!config && (
            <p className="app__hint">
              Backend isn't configured. Set <code>VITE_API_BASE_URL</code> and{" "}
              <code>VITE_API_ACCESS_KEY</code> (see .env.example) and rebuild/restart.
            </p>
          )}

          {view.kind === "error" && (
            <div className="app__error" role="alert">
              <strong>Extraction failed.</strong> {view.message}
            </div>
          )}

          {view.kind === "loading" && (
            <div className="app__loading" role="status">
              <span className="app__spinner" aria-hidden="true" />
              {view.stage === "uploading"
                ? "Uploading directly to storage…"
                : "Processing — this can take up to a couple of minutes on a multi-page drawing."}
            </div>
          )}

          {view.kind === "result" && (
            <section className="app__results">
              {preview && preview.jobId === activeJobId && (
                <DrawingPreview url={preview.url} name={preview.name} type={preview.type} />
              )}

              <div className="app__results-grid">
                <div className="app__results-col">
                  <ResultsSummary result={view.result} />
                  {"balloons" in view.result && <BalloonTable balloons={view.result.balloons} />}
                </div>

                {activeJobId && (
                  <div className="app__results-col">
                    <ReconciliationPanel
                      jobId={activeJobId}
                      config={config}
                      identity={identity}
                      onIdentityChange={handleIdentityChange}
                    />
                  </div>
                )}
              </div>
            </section>
          )}
        </main>

        <aside className="app__sidebar">
          <CollapsiblePanel title="Recent jobs" storageKey="recent-jobs">
            <JobHistory entries={history} activeJobId={activeJobId} onSelect={handleSelectHistory} onClear={handleClearHistory} />
          </CollapsiblePanel>

          {activeJobId && (
            <CollapsiblePanel
              title="AI assistant"
              subtitle="Analysis and feedback on this drawing's data"
              storageKey="ai-assistant"
              scrollable
            >
              <AssistantPanel jobId={activeJobId} config={config} />
            </CollapsiblePanel>
          )}
        </aside>
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
