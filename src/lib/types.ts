/**
 * Types mirroring wabtec_poc/src/models.py. Keep these in sync with the backend's pydantic models
 * -- they are the wire contract documented in architecture-poc.md §3.2.
 */

export type ToleranceType = "bilateral" | "unilateral" | "limit" | "general" | "none";

export interface GdtInfo {
  symbol: string;
  value: number;
  modifiers: string[];
  datums: string[];
}

export interface BoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface ExtractedBalloon {
  balloon_number: number;
  page: number;
  bounding_box: BoundingBox | null;
  nominal_value: number | null;
  unit: string | null;
  tolerance_type: ToleranceType | null;
  upper_tol: number | null;
  lower_tol: number | null;
  gdt: GdtInfo | null;
  surface_finish: string | null;
  notes: string | null;
  confidence: number;
  extraction_error: string | null;
  blocked: boolean;
}

export interface ExtractionResult {
  job_id: string;
  drawing_number: string | null;
  revision: string | null;
  balloon_count_detected: number;
  balloon_count_extracted: number;
  balloon_count_mismatch: boolean;
  balloons: ExtractedBalloon[];
  export_url: string | null;
  reconciliation: ReconciliationStatus | null;
}

export type JobStatus = "Processing" | "Complete" | "Failed";

export interface JobRecord {
  job_id: string;
  file_name: string;
  status: JobStatus;
  drawing_number: string | null;
  revision: string | null;
  balloon_count_detected: number;
  balloon_count_extracted: number;
  avg_confidence: number | null;
  created_at: string;
  completed_at: string | null;
  error_reason: string | null;
}

export interface ApiErrorBody {
  error: string;
  message: string;
  /** Present on a 409 IncompleteReconciliation response -- exactly which balloons are still
   * blocking sign-off/export (app.py's _map_domain_error). */
  openBalloons?: { page: number; balloonNumber: number }[];
}

/** Connection details for the backend: its base URL (a Vercel deployment, or
 * http://127.0.0.1:8000 locally) and the shared secret it checks as `x-api-key` -- the value of
 * its API_ACCESS_KEY. Held client-side only (localStorage), never sent anywhere but that backend. */
export interface ConnectionConfig {
  baseUrl: string;
  apiKey: string;
}

/** Response from POST /api/drawings/upload-url -- see api.ts's module docstring. */
export interface CreateUploadUrlResponse {
  jobId: string;
  uploadUrl: string;
  blobPath: string;
}

/**
 * Reconciliation: the human quality-check pass every balloon goes through before its drawing is
 * exportable -- see wabtec_poc/src/reconciliation.py for the state machine these mirror.
 */

export type ReviewAction = "confirm" | "correct" | "cannot_determine";

export type BalloonReviewStatus = "pending" | "reconciled" | "cannot_determine";

export interface BalloonReviewRecord {
  page: number;
  balloon_number: number;
  extracted: ExtractedBalloon;
  reviewed: ExtractedBalloon | null;
  status: BalloonReviewStatus;
  discrepancy: boolean;
  reviewer_id: string | null;
  reviewed_at: string | null;
  notes: string | null;
}

/** Full state for one drawing -- GET /api/drawings/{jobId}/reconciliation, and the shape POST
 * .../signoff returns. */
export interface ReconciliationRecord {
  job_id: string;
  drawing_number: string | null;
  revision: string | null;
  submitted_by: string | null;
  balloons: BalloonReviewRecord[];
  signed_off: boolean;
  signed_off_by: string | null;
  signed_off_at: string | null;
  created_at: string;
}

/** Summary shape embedded in ExtractionResult right after extraction. */
export interface ReconciliationStatus {
  job_id: string;
  total_balloons: number;
  pending: number;
  reconciled: number;
  cannot_determine: number;
  percent_complete: number;
  ready_for_signoff: boolean;
  signed_off: boolean;
  signed_off_by: string | null;
  signed_off_at: string | null;
}

/** One entry in the client-side job history list (lib/storage.ts). */
export interface HistoryEntry {
  jobId: string;
  fileName: string;
  submittedAt: string;
  drawingNumber: string | null;
  balloonCountMismatch: boolean | null;
}

/**
 * AI chatbot: general analysis + feedback -- see wabtec_poc/src/chat_assistant.py and
 * src/analysis_rules.py. `AnalysisFinding.source` distinguishes a deterministic, always-
 * reproducible rule check from something Claude added/elaborated on during the review pass.
 */

export type AnalysisFindingCategory = "missing_info" | "incomplete_data" | "inconsistency" | "common_mistake";

export type AnalysisFindingSeverity = "info" | "warning" | "critical";

export type AnalysisFindingSource = "rule" | "ai";

export interface BalloonRef {
  page: number;
  balloon_number: number;
}

export interface AnalysisFinding {
  category: AnalysisFindingCategory;
  severity: AnalysisFindingSeverity;
  summary: string;
  detail: string;
  balloon_refs: BalloonRef[];
  source: AnalysisFindingSource;
}

/** Response body for POST /api/drawings/{jobId}/analyze. */
export interface AnalysisReport {
  job_id: string;
  generated_at: string;
  summary: string;
  findings: AnalysisFinding[];
}

/** One turn in a chat conversation -- kept client-side only (lib/storage.ts) and resent as
 * `history` on every POST /api/drawings/{jobId}/chat call; the backend itself is stateless. */
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}
