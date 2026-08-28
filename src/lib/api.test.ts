import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiClientError,
  NotConfiguredError,
  VERCEL_DIRECT_UPLOAD_MAX_BYTES,
  createUploadUrl,
  exportDrawing,
  extractDrawing,
  extractDrawingSmart,
  extractLargeDrawing,
  getDrawingResult,
  getReconciliation,
  processDrawing,
  reviewBalloon,
  signOff,
  uploadFileToBlob,
} from "./api";
import type { ConnectionConfig, CreateUploadUrlResponse, ExtractionResult, JobRecord, ReconciliationRecord } from "./types";

const CONFIG: ConnectionConfig = { baseUrl: "https://bdx-poc.vercel.app/", apiKey: "test-secret" };
const LOCAL_CONFIG: ConnectionConfig = { baseUrl: "http://127.0.0.1:8000", apiKey: "local-secret" };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const SAMPLE_RESULT: ExtractionResult = {
  job_id: "job-1",
  drawing_number: "DWG-1",
  revision: "A",
  balloon_count_detected: 1,
  balloon_count_extracted: 1,
  balloon_count_mismatch: false,
  balloons: [],
  export_url: null,
  reconciliation: {
    job_id: "job-1",
    total_balloons: 1,
    pending: 1,
    reconciled: 0,
    cannot_determine: 0,
    percent_complete: 0,
    ready_for_signoff: false,
    signed_off: false,
    signed_off_by: null,
    signed_off_at: null,
  },
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("extractDrawing", () => {
  it("throws NotConfiguredError when config is null", async () => {
    await expect(extractDrawing(null, new File(["x"], "a.pdf"))).rejects.toBeInstanceOf(NotConfiguredError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("posts multipart form data with the x-api-key header, trimming a trailing slash from baseUrl", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(SAMPLE_RESULT));

    const file = new File(["%PDF-1.4"], "dwg.pdf", { type: "application/pdf" });
    const returned = await extractDrawing(CONFIG, file, { templateId: "as9102-form3" });

    expect(returned).toEqual(SAMPLE_RESULT);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://bdx-poc.vercel.app/api/drawings/extract"); // no double slash
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>)["x-api-key"]).toBe("test-secret");
    const form = init?.body as FormData;
    expect(form.get("file")).toBe(file);
    expect(form.get("templateId")).toBe("as9102-form3");
  });

  it("includes submittedBy in the form when provided", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(SAMPLE_RESULT));

    await extractDrawing(CONFIG, new File(["x"], "a.pdf"), { submittedBy: "alice" });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const form = init?.body as FormData;
    expect(form.get("submittedBy")).toBe("alice");
  });

  it("works against a locally-run backend on 127.0.0.1", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(SAMPLE_RESULT));

    await extractDrawing(LOCAL_CONFIG, new File(["x"], "a.pdf", { type: "application/pdf" }));

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("http://127.0.0.1:8000/api/drawings/extract");
    expect((init?.headers as Record<string, string>)["x-api-key"]).toBe("local-secret");
  });

  it("raises ApiClientError with the server-provided message on a non-2xx response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: "QualityThresholdNotMet", message: "Image resolution 72 DPI is below the minimum." }, 422)
    );

    const err = await extractDrawing(CONFIG, new File(["x"], "a.png", { type: "image/png" })).catch((e) => e);

    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).status).toBe(422);
    expect((err as ApiClientError).message).toMatch(/below the minimum/);
  });

  it("falls back to a generic message when the error body isn't valid JSON", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("<html>502</html>", { status: 502 }));

    const err = await extractDrawing(CONFIG, new File(["x"], "a.pdf")).catch((e) => e);

    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).status).toBe(502);
    expect((err as ApiClientError).message).toMatch(/HTTP 502/);
  });
});

describe("getDrawingResult", () => {
  it("GETs the job by id with the x-api-key header", async () => {
    const job: JobRecord = {
      job_id: "job-1",
      file_name: "dwg.pdf",
      status: "Complete",
      drawing_number: "DWG-1",
      revision: "A",
      balloon_count_detected: 3,
      balloon_count_extracted: 3,
      avg_confidence: 0.9,
      created_at: "2026-08-26T00:00:00Z",
      completed_at: "2026-08-26T00:01:00Z",
      error_reason: null,
    };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(job));

    const returned = await getDrawingResult(CONFIG, "job-1");

    expect(returned).toEqual(job);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://bdx-poc.vercel.app/api/drawings/job-1");
    expect((init?.headers as Record<string, string>)["x-api-key"]).toBe("test-secret");
  });

  it("raises ApiClientError(404) for an unknown job id", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: "NotFound", message: "No job found for id 'nope'." }, 404));

    const err = await getDrawingResult(CONFIG, "nope").catch((e) => e);

    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).status).toBe(404);
  });
});

describe("createUploadUrl", () => {
  it("posts JSON with the x-api-key header and returns the SAS details", async () => {
    const response: CreateUploadUrlResponse = { jobId: "job-1", uploadUrl: "https://blob/sas?token=1", blobPath: "job-1/source_dwg.pdf" };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(response, 201));

    const returned = await createUploadUrl(CONFIG, "dwg.pdf", "application/pdf");

    expect(returned).toEqual(response);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://bdx-poc.vercel.app/api/drawings/upload-url");
    expect((init?.headers as Record<string, string>)["x-api-key"]).toBe("test-secret");
    expect(JSON.parse(init?.body as string)).toEqual({ fileName: "dwg.pdf", contentType: "application/pdf" });
  });
});

describe("uploadFileToBlob", () => {
  it("PUTs the file directly to the SAS URL with the blob-type header, no auth header from config", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 201 }));
    const file = new File(["bytes"], "dwg.pdf", { type: "application/pdf" });

    await uploadFileToBlob("https://blob.core.windows.net/raw-drawings/job-1/source_dwg.pdf?sas=1", file);

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://blob.core.windows.net/raw-drawings/job-1/source_dwg.pdf?sas=1");
    expect(init?.method).toBe("PUT");
    const headers = init?.headers as Record<string, string>;
    expect(headers["x-ms-blob-type"]).toBe("BlockBlob");
    expect(headers["x-api-key"]).toBeUndefined();
    expect(init?.body).toBe(file);
  });

  it("throws ApiClientError on a non-2xx response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("<Error>...</Error>", { status: 403 }));

    const err = await uploadFileToBlob("https://blob/sas", new File(["x"], "a.pdf")).catch((e) => e);

    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).status).toBe(403);
  });
});

describe("processDrawing", () => {
  it("posts the blob path + content type and returns the extraction result", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(SAMPLE_RESULT));

    const returned = await processDrawing(CONFIG, "job-1", "job-1/source_dwg.pdf", "application/pdf");

    expect(returned).toEqual(SAMPLE_RESULT);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://bdx-poc.vercel.app/api/drawings/job-1/process");
    expect(JSON.parse(init?.body as string)).toEqual({ blobPath: "job-1/source_dwg.pdf", contentType: "application/pdf" });
  });

  it("includes submittedBy when provided", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(SAMPLE_RESULT));

    await processDrawing(CONFIG, "job-1", "job-1/source_dwg.pdf", "application/pdf", "alice");

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(init?.body as string).submittedBy).toBe("alice");
  });
});

describe("getReconciliation", () => {
  it("GETs the full reconciliation record with the x-api-key header", async () => {
    const record: ReconciliationRecord = {
      job_id: "job-1",
      drawing_number: "DWG-1",
      revision: "A",
      submitted_by: "alice",
      balloons: [],
      signed_off: false,
      signed_off_by: null,
      signed_off_at: null,
      created_at: "2026-08-26T00:00:00Z",
    };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(record));

    const returned = await getReconciliation(CONFIG, "job-1");

    expect(returned).toEqual(record);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://bdx-poc.vercel.app/api/drawings/job-1/reconciliation");
    expect((init?.headers as Record<string, string>)["x-api-key"]).toBe("test-secret");
  });
});

describe("reviewBalloon", () => {
  it("posts reviewerId/action to the page+balloonNumber-scoped route", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ status: "reconciled" }));

    await reviewBalloon(CONFIG, "job-1", 1, 12, "bob", "confirm");

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://bdx-poc.vercel.app/api/drawings/job-1/balloons/1/12/review");
    expect(JSON.parse(init?.body as string)).toMatchObject({ reviewerId: "bob", action: "confirm" });
  });

  it("raises ApiClientError(403) with the openBalloons-free segregation-of-duties message", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: "SegregationOfDutiesViolation", message: "Reviewer 'alice' must differ from the analyst..." }, 403)
    );

    const err = await reviewBalloon(CONFIG, "job-1", 1, 12, "alice", "confirm").catch((e) => e);

    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).status).toBe(403);
  });
});

describe("signOff", () => {
  it("posts signerId and returns the updated record", async () => {
    const record: ReconciliationRecord = {
      job_id: "job-1",
      drawing_number: "DWG-1",
      revision: "A",
      submitted_by: "alice",
      balloons: [],
      signed_off: true,
      signed_off_by: "bob",
      signed_off_at: "2026-08-26T00:05:00Z",
      created_at: "2026-08-26T00:00:00Z",
    };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(record));

    const returned = await signOff(CONFIG, "job-1", "bob");

    expect(returned).toEqual(record);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://bdx-poc.vercel.app/api/drawings/job-1/signoff");
    expect(JSON.parse(init?.body as string)).toEqual({ signerId: "bob" });
  });

  it("raises ApiClientError(409) with openBalloons when reconciliation is incomplete", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(
        { error: "IncompleteReconciliation", message: "1 of 2 balloons are not yet reconciled.", openBalloons: [{ page: 1, balloonNumber: 2 }] },
        409
      )
    );

    const err = await signOff(CONFIG, "job-1", "bob").catch((e) => e);

    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).status).toBe(409);
    expect((err as ApiClientError).body?.openBalloons).toEqual([{ page: 1, balloonNumber: 2 }]);
  });
});

describe("exportDrawing", () => {
  it("POSTs with no body and returns the export URL", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ jobId: "job-1", exportUrl: "https://example/export.xlsx" }));

    const returned = await exportDrawing(CONFIG, "job-1");

    expect(returned).toEqual({ jobId: "job-1", exportUrl: "https://example/export.xlsx" });
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://bdx-poc.vercel.app/api/drawings/job-1/export");
    expect(init?.method).toBe("POST");
  });

  it("raises ApiClientError(409) when export is attempted before signoff", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: "IncompleteReconciliation", message: "This drawing has not been signed off..." }, 409)
    );

    const err = await exportDrawing(CONFIG, "job-1").catch((e) => e);

    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).status).toBe(409);
  });
});

describe("extractLargeDrawing", () => {
  it("orchestrates upload-url -> PUT -> process, reporting stage changes in order", async () => {
    const response: CreateUploadUrlResponse = { jobId: "job-1", uploadUrl: "https://blob/sas?token=1", blobPath: "job-1/source_dwg.pdf" };
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(response, 201)) // createUploadUrl
      .mockResolvedValueOnce(new Response(null, { status: 201 })) // uploadFileToBlob
      .mockResolvedValueOnce(jsonResponse(SAMPLE_RESULT)); // processDrawing

    const stages: string[] = [];
    const file = new File(["big file bytes"], "dwg.pdf", { type: "application/pdf" });
    const returned = await extractLargeDrawing(CONFIG, file, (stage) => stages.push(stage));

    expect(returned).toEqual(SAMPLE_RESULT);
    expect(stages).toEqual(["uploading", "processing"]);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("https://bdx-poc.vercel.app/api/drawings/upload-url");
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe("https://blob/sas?token=1");
    expect(vi.mocked(fetch).mock.calls[2][0]).toBe("https://bdx-poc.vercel.app/api/drawings/job-1/process");
  });
});

describe("extractDrawingSmart", () => {
  it("uses the single-call path for a small file", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(SAMPLE_RESULT));
    const smallFile = new File(["small"], "small.pdf", { type: "application/pdf" });

    await extractDrawingSmart(CONFIG, smallFile);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("https://bdx-poc.vercel.app/api/drawings/extract");
  });

  it("uses the three-step large-file path once the file exceeds the threshold", async () => {
    const response: CreateUploadUrlResponse = { jobId: "job-1", uploadUrl: "https://blob/sas?token=1", blobPath: "job-1/source_big.pdf" };
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(response, 201))
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(jsonResponse(SAMPLE_RESULT));
    const bigFile = new File([new Uint8Array(VERCEL_DIRECT_UPLOAD_MAX_BYTES + 1)], "big.pdf", { type: "application/pdf" });

    await extractDrawingSmart(CONFIG, bigFile);

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("https://bdx-poc.vercel.app/api/drawings/upload-url");
  });

  it("takes the large-file path against a local backend too, so local testing matches production", async () => {
    const response: CreateUploadUrlResponse = { jobId: "job-big", uploadUrl: "https://blob/sas?token=1", blobPath: "job-big/source_big.pdf" };
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(response, 201))
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(jsonResponse(SAMPLE_RESULT));
    const bigFile = new File([new Uint8Array(VERCEL_DIRECT_UPLOAD_MAX_BYTES + 1)], "big.pdf", { type: "application/pdf" });

    await extractDrawingSmart(LOCAL_CONFIG, bigFile);

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("http://127.0.0.1:8000/api/drawings/upload-url");
  });
});
