import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError, NotConfiguredError, extractDrawing, getDrawingResult } from "./api";
import type { ConnectionConfig, ExtractionResult, JobRecord } from "./types";

const CONFIG: ConnectionConfig = { baseUrl: "https://bdx-poc.azurewebsites.net/", functionKey: "test-key" };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

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

  it("posts multipart form data with the function key header and trims a trailing slash from baseUrl", async () => {
    const result: ExtractionResult = {
      job_id: "job-1",
      drawing_number: "DWG-1",
      revision: "A",
      balloon_count_detected: 1,
      balloon_count_extracted: 1,
      balloon_count_mismatch: false,
      balloons: [],
      export_url: null,
    };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(result));

    const file = new File(["%PDF-1.4"], "dwg.pdf", { type: "application/pdf" });
    const returned = await extractDrawing(CONFIG, file, { templateId: "as9102-form3" });

    expect(returned).toEqual(result);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://bdx-poc.azurewebsites.net/api/drawings/extract"); // no double slash
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>)["x-functions-key"]).toBe("test-key");
    const form = init?.body as FormData;
    expect(form.get("file")).toBe(file);
    expect(form.get("templateId")).toBe("as9102-form3");
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

    const returned = await getDrawingResult(CONFIG, "job-1");

    expect(returned).toEqual(job);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://bdx-poc.azurewebsites.net/api/drawings/job-1");
    expect((init?.headers as Record<string, string>)["x-functions-key"]).toBe("test-key");
  });

  it("raises ApiClientError(404) for an unknown job id", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: "NotFound", message: "No job found for id 'nope'." }, 404));

    const err = await getDrawingResult(CONFIG, "nope").catch((e) => e);

    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).status).toBe(404);
  });
});
