import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiClientError,
  NotConfiguredError,
  VERCEL_DIRECT_UPLOAD_MAX_BYTES,
  createUploadUrl,
  extractDrawing,
  extractDrawingSmart,
  extractLargeDrawing,
  getDrawingResult,
  processDrawing,
  uploadFileToBlob,
} from "./api";
import type { ConnectionConfig, CreateUploadUrlResponse, ExtractionResult, JobRecord } from "./types";

const AZURE_CONFIG: ConnectionConfig = { baseUrl: "https://bdx-poc.azurewebsites.net/", functionKey: "test-key", backendType: "azure" };
const VERCEL_CONFIG: ConnectionConfig = { baseUrl: "https://bdx-poc.vercel.app/", functionKey: "test-secret", backendType: "vercel" };

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

  it("posts multipart form data with the function key header on an azure backend, trimming a trailing slash from baseUrl", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(SAMPLE_RESULT));

    const file = new File(["%PDF-1.4"], "dwg.pdf", { type: "application/pdf" });
    const returned = await extractDrawing(AZURE_CONFIG, file, { templateId: "as9102-form3" });

    expect(returned).toEqual(SAMPLE_RESULT);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://bdx-poc.azurewebsites.net/api/drawings/extract"); // no double slash
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>)["x-functions-key"]).toBe("test-key");
    expect((init?.headers as Record<string, string>)["x-api-key"]).toBeUndefined();
    const form = init?.body as FormData;
    expect(form.get("file")).toBe(file);
    expect(form.get("templateId")).toBe("as9102-form3");
  });

  it("uses x-api-key instead on a vercel backend", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(SAMPLE_RESULT));

    await extractDrawing(VERCEL_CONFIG, new File(["x"], "a.pdf", { type: "application/pdf" }));

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("test-secret");
    expect(headers["x-functions-key"]).toBeUndefined();
  });

  it("raises ApiClientError with the server-provided message on a non-2xx response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: "QualityThresholdNotMet", message: "Image resolution 72 DPI is below the minimum." }, 422)
    );

    const err = await extractDrawing(AZURE_CONFIG, new File(["x"], "a.png", { type: "image/png" })).catch((e) => e);

    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).status).toBe(422);
    expect((err as ApiClientError).message).toMatch(/below the minimum/);
  });

  it("falls back to a generic message when the error body isn't valid JSON", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("<html>502</html>", { status: 502 }));

    const err = await extractDrawing(AZURE_CONFIG, new File(["x"], "a.pdf")).catch((e) => e);

    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).status).toBe(502);
    expect((err as ApiClientError).message).toMatch(/HTTP 502/);
  });
});

describe("getDrawingResult", () => {
  it("GETs the job by id with the function key header", async () => {
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

    const returned = await getDrawingResult(AZURE_CONFIG, "job-1");

    expect(returned).toEqual(job);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://bdx-poc.azurewebsites.net/api/drawings/job-1");
    expect((init?.headers as Record<string, string>)["x-functions-key"]).toBe("test-key");
  });

  it("raises ApiClientError(404) for an unknown job id", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: "NotFound", message: "No job found for id 'nope'." }, 404));

    const err = await getDrawingResult(AZURE_CONFIG, "nope").catch((e) => e);

    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).status).toBe(404);
  });
});

describe("createUploadUrl", () => {
  it("posts JSON with the x-api-key header and returns the SAS details", async () => {
    const response: CreateUploadUrlResponse = { jobId: "job-1", uploadUrl: "https://blob/sas?token=1", blobPath: "job-1/source_dwg.pdf" };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(response, 201));

    const returned = await createUploadUrl(VERCEL_CONFIG, "dwg.pdf", "application/pdf");

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
    expect(headers["x-functions-key"]).toBeUndefined();
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

    const returned = await processDrawing(VERCEL_CONFIG, "job-1", "job-1/source_dwg.pdf", "application/pdf");

    expect(returned).toEqual(SAMPLE_RESULT);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://bdx-poc.vercel.app/api/drawings/job-1/process");
    expect(JSON.parse(init?.body as string)).toEqual({ blobPath: "job-1/source_dwg.pdf", contentType: "application/pdf" });
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
    const returned = await extractLargeDrawing(VERCEL_CONFIG, file, (stage) => stages.push(stage));

    expect(returned).toEqual(SAMPLE_RESULT);
    expect(stages).toEqual(["uploading", "processing"]);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("https://bdx-poc.vercel.app/api/drawings/upload-url");
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe("https://blob/sas?token=1");
    expect(vi.mocked(fetch).mock.calls[2][0]).toBe("https://bdx-poc.vercel.app/api/drawings/job-1/process");
  });
});

describe("extractDrawingSmart", () => {
  it("uses the single-call path on an azure backend regardless of file size", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(SAMPLE_RESULT));
    const bigFile = new File([new Uint8Array(VERCEL_DIRECT_UPLOAD_MAX_BYTES + 1)], "big.pdf", { type: "application/pdf" });

    await extractDrawingSmart(AZURE_CONFIG, bigFile);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("https://bdx-poc.azurewebsites.net/api/drawings/extract");
  });

  it("uses the single-call path on vercel for a small file", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(SAMPLE_RESULT));
    const smallFile = new File(["small"], "small.pdf", { type: "application/pdf" });

    await extractDrawingSmart(VERCEL_CONFIG, smallFile);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("https://bdx-poc.vercel.app/api/drawings/extract");
  });

  it("uses the three-step large-file path on vercel once the file exceeds the threshold", async () => {
    const response: CreateUploadUrlResponse = { jobId: "job-1", uploadUrl: "https://blob/sas?token=1", blobPath: "job-1/source_big.pdf" };
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(response, 201))
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(jsonResponse(SAMPLE_RESULT));
    const bigFile = new File([new Uint8Array(VERCEL_DIRECT_UPLOAD_MAX_BYTES + 1)], "big.pdf", { type: "application/pdf" });

    await extractDrawingSmart(VERCEL_CONFIG, bigFile);

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("https://bdx-poc.vercel.app/api/drawings/upload-url");
  });
});
