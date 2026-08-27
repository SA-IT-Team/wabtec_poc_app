/**
 * Types mirroring poc/src/models.py. Keep these in sync with the backend's pydantic models --
 * they are the wire contract documented in architecture-poc.md §3.2.
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
  openBalloonIds?: string[];
}

/** Connection details for a deployed Function App -- see poc/deployment.md §4. Held client-side
 * only (localStorage), never sent anywhere but the configured Function App itself. */
export interface ConnectionConfig {
  baseUrl: string;
  functionKey: string;
}

/** One entry in the client-side job history list (lib/storage.ts). */
export interface HistoryEntry {
  jobId: string;
  fileName: string;
  submittedAt: string;
  drawingNumber: string | null;
  balloonCountMismatch: boolean | null;
}
