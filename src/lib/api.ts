/**
 * Typed client for the wabtec_poc backend:
 *   POST /api/drawings/extract                                       -- upload + synchronously extract one drawing (draft)
 *   POST /api/drawings/upload-url                                    -- get a direct-to-blob SAS URL (large-file path, step 1)
 *   POST /api/drawings/<jobId>/process                               -- extract a drawing already uploaded via that SAS (step 2)
 *   GET  /api/drawings/{jobId}                                       -- re-fetch a previously computed job record
 *   GET  /api/drawings/{jobId}/reconciliation                        -- full reconciliation state, every balloon
 *   POST /api/drawings/{jobId}/balloons/{page}/{balloonNumber}/review -- confirm/correct/flag one balloon
 *   POST /api/drawings/{jobId}/signoff                                -- sign off once every balloon is reconciled
 *   POST /api/drawings/{jobId}/export                                  -- generate the Excel, only once signed off
 *
 * Auth is a single shared secret sent as `x-api-key`, matching the backend's API_ACCESS_KEY (see
 * wabtec_poc/app.py's module docstring for why it needs one at all -- there is no user auth, see
 * wabtec_poc/doc/architecture-poc.md §3.3). The key is supplied by whoever is running this app
 * against their own deployment and stored only in that browser's localStorage.
 *
 * Extraction no longer returns an immediate export_url -- it returns a *draft* with every balloon
 * `pending`. Nothing is exportable until each balloon has been reviewed and the drawing signed
 * off (the reconciliation functions below) -- see wabtec_poc/src/reconciliation.py.
 *
 * Why two upload paths: Vercel caps request/response bodies at 4.5MB, platform-wide, not
 * configurable. Real multi-page ballooned drawings routinely exceed that, so anything above
 * VERCEL_DIRECT_UPLOAD_MAX_BYTES goes through upload-url + a direct browser-to-Blob-Storage PUT +
 * process instead of extractDrawing's single multipart call. See
 * wabtec_poc/deployment-vercel.md §4.
 */
import type {
  ApiErrorBody,
  ConnectionConfig,
  CreateUploadUrlResponse,
  ExtractedBalloon,
  ExtractionResult,
  JobRecord,
  ReconciliationRecord,
  ReviewAction,
} from "./types";

export class ApiClientError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody | null;

  constructor(status: number, body: ApiErrorBody | null, message: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.body = body;
  }
}

/** Thrown when baseUrl/apiKey haven't been configured yet. */
export class NotConfiguredError extends Error {
  constructor() {
    super("Backend URL and key are not configured yet.");
    this.name = "NotConfiguredError";
  }
}

/** Stay safely under Vercel's hard 4.5MB request-body cap for the direct multipart path; above
 * this, extractDrawingSmart switches to the upload-url + process flow instead. */
export const VERCEL_DIRECT_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

function requireConfig(config: ConnectionConfig | null): asserts config is ConnectionConfig {
  if (!config || !config.baseUrl || !config.apiKey) {
    throw new NotConfiguredError();
  }
}

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function authHeaders(config: ConnectionConfig): Record<string, string> {
  return { "x-api-key": config.apiKey };
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  const json = await parseJsonSafe(res);
  if (!res.ok) {
    const body = (json as ApiErrorBody) ?? null;
    const message = body?.message ?? `Request failed with HTTP ${res.status}.`;
    throw new ApiClientError(res.status, body, message);
  }
  return json as T;
}

export interface ExtractOptions {
  templateId?: string;
  /** Self-declared identity, recorded so the reconciliation workflow can enforce segregation of
   * duties (a reviewer/signer can't be the same person who submitted the drawing). Not
   * authenticated -- see the module docstring. */
  submittedBy?: string;
  signal?: AbortSignal;
}

/** Single-call path: only safe for files under VERCEL_DIRECT_UPLOAD_MAX_BYTES -- see
 * extractDrawingSmart, which picks this or the large-file path by size. */
export async function extractDrawing(
  config: ConnectionConfig | null,
  file: File,
  options: ExtractOptions = {}
): Promise<ExtractionResult> {
  requireConfig(config);

  const form = new FormData();
  form.append("file", file);
  if (options.templateId) {
    form.append("templateId", options.templateId);
  }
  if (options.submittedBy) {
    form.append("submittedBy", options.submittedBy);
  }

  const res = await fetch(`${trimTrailingSlash(config.baseUrl)}/api/drawings/extract`, {
    method: "POST",
    headers: authHeaders(config),
    body: form,
    signal: options.signal,
  });
  return handleResponse<ExtractionResult>(res);
}

export async function getDrawingResult(
  config: ConnectionConfig | null,
  jobId: string,
  signal?: AbortSignal
): Promise<JobRecord> {
  requireConfig(config);

  const res = await fetch(`${trimTrailingSlash(config.baseUrl)}/api/drawings/${encodeURIComponent(jobId)}`, {
    headers: authHeaders(config),
    signal,
  });
  return handleResponse<JobRecord>(res);
}

// ---------------------------------------------------------------------------------------
// Large-file path: upload-url -> direct PUT to Blob Storage -> process
// ---------------------------------------------------------------------------------------

export async function createUploadUrl(
  config: ConnectionConfig | null,
  fileName: string,
  contentType: string,
  signal?: AbortSignal
): Promise<CreateUploadUrlResponse> {
  requireConfig(config);

  const res = await fetch(`${trimTrailingSlash(config.baseUrl)}/api/drawings/upload-url`, {
    method: "POST",
    headers: { ...authHeaders(config), "Content-Type": "application/json" },
    body: JSON.stringify({ fileName, contentType }),
    signal,
  });
  return handleResponse<CreateUploadUrlResponse>(res);
}

/** PUTs directly to Blob Storage via the SAS URL from createUploadUrl. This request goes
 * straight to Azure, never through the backend -- that's the entire point (bypasses Vercel's
 * 4.5MB cap entirely). No auth header from `config` belongs here: the SAS token embedded in
 * `uploadUrl` is the auth, and Blob Storage doesn't know about x-api-key. */
export async function uploadFileToBlob(uploadUrl: string, file: File, signal?: AbortSignal): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "x-ms-blob-type": "BlockBlob",
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
    signal,
  });
  if (!res.ok) {
    // Blob Storage returns XML error bodies, not this app's JSON error shape -- not worth
    // parsing for a POC client; the status code is the useful signal.
    throw new ApiClientError(res.status, null, `Direct upload to storage failed with HTTP ${res.status}.`);
  }
}

export async function processDrawing(
  config: ConnectionConfig | null,
  jobId: string,
  blobPath: string,
  contentType: string,
  submittedBy?: string,
  signal?: AbortSignal
): Promise<ExtractionResult> {
  requireConfig(config);

  const res = await fetch(`${trimTrailingSlash(config.baseUrl)}/api/drawings/${encodeURIComponent(jobId)}/process`, {
    method: "POST",
    headers: { ...authHeaders(config), "Content-Type": "application/json" },
    body: JSON.stringify({ blobPath, contentType, submittedBy: submittedBy || undefined }),
    signal,
  });
  return handleResponse<ExtractionResult>(res);
}

export type UploadStage = "uploading" | "processing";

/** Orchestrates the three-call large-file flow, reporting which step is in flight so the UI can
 * show something more specific than a single spinner across what's now a slower, multi-request
 * operation. */
export async function extractLargeDrawing(
  config: ConnectionConfig | null,
  file: File,
  onStageChange?: (stage: UploadStage) => void,
  submittedBy?: string,
  signal?: AbortSignal
): Promise<ExtractionResult> {
  requireConfig(config);
  const contentType = file.type || "application/octet-stream";

  onStageChange?.("uploading");
  const { jobId, uploadUrl, blobPath } = await createUploadUrl(config, file.name, contentType, signal);
  await uploadFileToBlob(uploadUrl, file, signal);

  onStageChange?.("processing");
  return processDrawing(config, jobId, blobPath, contentType, submittedBy, signal);
}

/** Picks the upload path by file size, so callers (App.tsx) don't need to know the 4.5MB rule
 * themselves. The threshold applies even against a locally-run backend, where Vercel's cap doesn't
 * exist -- deliberately, so local testing exercises the same path production will take. */
export async function extractDrawingSmart(
  config: ConnectionConfig | null,
  file: File,
  options: ExtractOptions & { onStageChange?: (stage: UploadStage) => void } = {}
): Promise<ExtractionResult> {
  requireConfig(config);

  if (file.size > VERCEL_DIRECT_UPLOAD_MAX_BYTES) {
    return extractLargeDrawing(config, file, options.onStageChange, options.submittedBy, options.signal);
  }
  return extractDrawing(config, file, options);
}

// ---------------------------------------------------------------------------------------
// Reconciliation: the human quality-check pass -- see wabtec_poc/src/reconciliation.py
// ---------------------------------------------------------------------------------------

export async function getReconciliation(
  config: ConnectionConfig | null,
  jobId: string,
  signal?: AbortSignal
): Promise<ReconciliationRecord> {
  requireConfig(config);

  const res = await fetch(`${trimTrailingSlash(config.baseUrl)}/api/drawings/${encodeURIComponent(jobId)}/reconciliation`, {
    headers: authHeaders(config),
    signal,
  });
  return handleResponse<ReconciliationRecord>(res);
}

export interface ReviewBalloonOptions {
  correctedValue?: ExtractedBalloon;
  notes?: string;
  signal?: AbortSignal;
}

export async function reviewBalloon(
  config: ConnectionConfig | null,
  jobId: string,
  page: number,
  balloonNumber: number,
  reviewerId: string,
  action: ReviewAction,
  options: ReviewBalloonOptions = {}
): Promise<ReconciliationRecord["balloons"][number]> {
  requireConfig(config);

  const res = await fetch(
    `${trimTrailingSlash(config.baseUrl)}/api/drawings/${encodeURIComponent(jobId)}/balloons/${page}/${balloonNumber}/review`,
    {
      method: "POST",
      headers: { ...authHeaders(config), "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewerId,
        action,
        correctedValue: options.correctedValue,
        notes: options.notes,
      }),
      signal: options.signal,
    }
  );
  return handleResponse(res);
}

export async function signOff(
  config: ConnectionConfig | null,
  jobId: string,
  signerId: string,
  signal?: AbortSignal
): Promise<ReconciliationRecord> {
  requireConfig(config);

  const res = await fetch(`${trimTrailingSlash(config.baseUrl)}/api/drawings/${encodeURIComponent(jobId)}/signoff`, {
    method: "POST",
    headers: { ...authHeaders(config), "Content-Type": "application/json" },
    body: JSON.stringify({ signerId }),
    signal,
  });
  return handleResponse<ReconciliationRecord>(res);
}

export interface ExportResponse {
  jobId: string;
  exportUrl: string;
}

export async function exportDrawing(config: ConnectionConfig | null, jobId: string, signal?: AbortSignal): Promise<ExportResponse> {
  requireConfig(config);

  const res = await fetch(`${trimTrailingSlash(config.baseUrl)}/api/drawings/${encodeURIComponent(jobId)}/export`, {
    method: "POST",
    headers: authHeaders(config),
    signal,
  });
  return handleResponse<ExportResponse>(res);
}
