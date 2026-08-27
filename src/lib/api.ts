/**
 * Typed client for the two POC endpoints (architecture-poc.md §3.2):
 *   POST /api/drawings/extract   -- upload + synchronously process one drawing
 *   GET  /api/drawings/{jobId}   -- re-fetch a previously computed job record
 *
 * Auth is the Function App's function-level key (x-functions-key header) -- there is no user
 * auth in the POC (see poc/architecture-poc.md §3.3). The key is supplied by whoever is running
 * this app against their own deployment and stored only in that browser's localStorage.
 */
import type { ApiErrorBody, ConnectionConfig, ExtractionResult, JobRecord } from "./types";

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

/** Thrown when baseUrl/functionKey haven't been configured yet. */
export class NotConfiguredError extends Error {
  constructor() {
    super("Function App URL and key are not configured yet.");
    this.name = "NotConfiguredError";
  }
}

function requireConfig(config: ConnectionConfig | null): asserts config is ConnectionConfig {
  if (!config || !config.baseUrl || !config.functionKey) {
    throw new NotConfiguredError();
  }
}

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
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
  signal?: AbortSignal;
}

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

  const res = await fetch(`${trimTrailingSlash(config.baseUrl)}/api/drawings/extract`, {
    method: "POST",
    headers: { "x-functions-key": config.functionKey },
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

  const res = await fetch(
    `${trimTrailingSlash(config.baseUrl)}/api/drawings/${encodeURIComponent(jobId)}`,
    { headers: { "x-functions-key": config.functionKey }, signal }
  );
  return handleResponse<JobRecord>(res);
}
