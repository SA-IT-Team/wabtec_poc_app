import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { VERCEL_DIRECT_UPLOAD_MAX_BYTES } from "./lib/api";
import type { CreateUploadUrlResponse, ExtractionResult, ReconciliationRecord } from "./lib/types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function reconciliationFor(jobId: string, drawingNumber: string | null, submittedBy: string | null = null): ReconciliationRecord {
  return {
    job_id: jobId,
    drawing_number: drawingNumber,
    template_id: null,
    revision: null,
    submitted_by: submittedBy,
    balloons: [
      {
        page: 1,
        balloon_number: 12,
        extracted: {
          balloon_number: 12,
          page: 1,
          bounding_box: null,
          nominal_value: 25.4,
          unit: "mm",
          tolerance_type: "bilateral",
          upper_tol: 0.05,
          lower_tol: -0.05,
          gdt: null,
          surface_finish: null,
          notes: null,
          confidence: 0.94,
          extraction_error: null,
          blocked: false,
        },
        reviewed: null,
        status: "pending",
        discrepancy: false,
        reviewer_id: null,
        reviewed_at: null,
        notes: null,
      },
    ],
    signed_off: false,
    signed_off_by: null,
    signed_off_at: null,
    created_at: "2026-08-26T00:00:00Z",
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn());
  // Backend connection is env-configured (lib/env.ts), not entered in the UI -- stub a working
  // config by default so most tests exercise an already-connected app; the two tests below cover
  // the unconfigured state explicitly by unstubbing it again.
  vi.stubEnv("VITE_API_BASE_URL", "https://bdx-poc.vercel.app");
  vi.stubEnv("VITE_API_ACCESS_KEY", "test-secret");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("App", () => {
  it("shows a hint and disables Extract when the backend isn't configured", () => {
    // Explicitly blank, not just unstubbed -- unstubbing alone would fall back to whatever a
    // real .env.local sets for local dev, not "unconfigured".
    vi.stubEnv("VITE_API_BASE_URL", "");
    vi.stubEnv("VITE_API_ACCESS_KEY", "");
    render(<App />);
    expect(screen.getByText(/backend isn't configured/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /extract/i })).toBeDisabled();
  });

  it("allows extraction once VITE_API_BASE_URL / VITE_API_ACCESS_KEY are set", () => {
    render(<App />);
    expect(screen.queryByText(/backend isn't configured/i)).not.toBeInTheDocument();
  });

  it("uploads a file and renders the draft result with pending reconciliation, including a mismatch banner", async () => {
    const user = userEvent.setup();
    const result: ExtractionResult = {
      job_id: "job-abc12345",
      drawing_number: "DWG-10245",
      revision: "C",
      balloon_count_detected: 2,
      balloon_count_extracted: 1,
      balloon_count_mismatch: true,
      balloons: [
        {
          balloon_number: 12,
          page: 1,
          bounding_box: null,
          nominal_value: 25.4,
          unit: "mm",
          tolerance_type: "bilateral",
          upper_tol: 0.05,
          lower_tol: -0.05,
          gdt: null,
          surface_finish: null,
          notes: null,
          confidence: 0.94,
          extraction_error: null,
          blocked: false,
        },
      ],
      export_url: null,
      reconciliation: {
        job_id: "job-abc12345",
        total_balloons: 2,
        pending: 2,
        reconciled: 0,
        cannot_determine: 0,
        percent_complete: 0,
        ready_for_signoff: false,
        signed_off: false,
        signed_off_by: null,
        signed_off_at: null,
      },
    };
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(result)) // extract
      .mockResolvedValueOnce(jsonResponse(reconciliationFor("job-abc12345", "DWG-10245"))); // ReconciliationPanel's own fetch

    render(<App />);

    const file = new File(["%PDF-1.4"], "dwg.pdf", { type: "application/pdf" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);
    await user.click(screen.getByRole("button", { name: /extract/i }));

    await waitFor(() => expect(screen.getByText("DWG-10245")).toBeInTheDocument());
    expect(screen.getByText(/balloon count mismatch/)).toBeInTheDocument();
    // extraction no longer auto-exports -- no download link until reconciled + signed off
    expect(screen.queryByRole("link", { name: /download excel export/i })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("0 / 1 reconciled")).toBeInTheDocument());

    // it also lands in job history
    const history = screen.getByText(/recent jobs/i).closest<HTMLElement>(".collapsible-panel")!;
    expect(within(history).getByText("dwg.pdf")).toBeInTheDocument();
  });

  it("shows a readable error message when the API call fails", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: "QualityThresholdNotMet", message: "Image resolution 72 DPI is below the minimum of 200 DPI." }, 422)
    );

    render(<App />);

    const file = new File(["x"], "scan.png", { type: "image/png" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);
    await user.click(screen.getByRole("button", { name: /extract/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent(/below the minimum of 200 DPI/);
  });

  it("sends the shared secret as x-api-key on upload", async () => {
    const user = userEvent.setup();
    const result: ExtractionResult = {
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
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(result))
      .mockResolvedValueOnce(jsonResponse(reconciliationFor("job-1", "DWG-1")));

    render(<App />);

    const file = new File(["%PDF-1.4"], "dwg.pdf", { type: "application/pdf" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);
    await user.click(screen.getByRole("button", { name: /extract/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://bdx-poc.vercel.app/api/drawings/extract");
    expect((init?.headers as Record<string, string>)["x-api-key"]).toBe("test-secret");
  });

  it("routes a file over the size threshold through the upload-url/PUT/process flow", async () => {
    const user = userEvent.setup();
    const uploadUrlResponse: CreateUploadUrlResponse = {
      jobId: "job-big",
      uploadUrl: "https://blob.core.windows.net/raw-drawings/job-big/source_big.pdf?sas=1",
      blobPath: "job-big/source_big.pdf",
    };
    const result: ExtractionResult = {
      job_id: "job-big",
      drawing_number: "DWG-BIG",
      revision: null,
      balloon_count_detected: 5,
      balloon_count_extracted: 5,
      balloon_count_mismatch: false,
      balloons: [],
      export_url: null,
      reconciliation: {
        job_id: "job-big",
        total_balloons: 5,
        pending: 5,
        reconciled: 0,
        cannot_determine: 0,
        percent_complete: 0,
        ready_for_signoff: false,
        signed_off: false,
        signed_off_by: null,
        signed_off_at: null,
      },
    };
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(uploadUrlResponse, 201)) // POST upload-url
      .mockResolvedValueOnce(new Response(null, { status: 201 })) // PUT to blob
      .mockResolvedValueOnce(jsonResponse(result)) // POST process
      .mockResolvedValueOnce(jsonResponse(reconciliationFor("job-big", "DWG-BIG"))); // ReconciliationPanel's fetch

    render(<App />);

    const bigFile = new File([new Uint8Array(VERCEL_DIRECT_UPLOAD_MAX_BYTES + 1)], "big.pdf", { type: "application/pdf" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, bigFile);
    await user.click(screen.getByRole("button", { name: /extract/i }));

    await waitFor(() => expect(screen.getByText("DWG-BIG")).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("https://bdx-poc.vercel.app/api/drawings/upload-url");
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe(uploadUrlResponse.uploadUrl);
    expect(vi.mocked(fetch).mock.calls[2][0]).toBe("https://bdx-poc.vercel.app/api/drawings/job-big/process");
    // step 2 (the PUT) must not carry this app's auth header -- it goes straight to Blob Storage
    const putInit = vi.mocked(fetch).mock.calls[1][1];
    expect((putInit?.headers as Record<string, string>)["x-api-key"]).toBeUndefined();
  });

  it("takes a drawing through review, signoff, and export via the reconciliation panel", async () => {
    const user = userEvent.setup();
    const result: ExtractionResult = {
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
    const pending = reconciliationFor("job-1", "DWG-1", "alice");
    const reconciled = { ...pending, balloons: [{ ...pending.balloons[0], status: "reconciled" as const, reviewer_id: "bob", reviewed: pending.balloons[0].extracted }] };
    const signedOff = { ...reconciled, signed_off: true, signed_off_by: "bob", signed_off_at: "2026-08-26T00:05:00Z" };

    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(result)) // extract
      .mockResolvedValueOnce(jsonResponse(pending)) // ReconciliationPanel initial load
      .mockResolvedValueOnce(jsonResponse(reconciled.balloons[0])) // POST review (confirm)
      .mockResolvedValueOnce(jsonResponse(reconciled)) // reload after review
      .mockResolvedValueOnce(jsonResponse(signedOff)) // POST signoff
      .mockResolvedValueOnce(jsonResponse(signedOff)) // reload after signoff
      .mockResolvedValueOnce(jsonResponse({ jobId: "job-1", exportUrl: "https://example/export.xlsx" })); // POST export

    render(<App />);

    const file = new File(["%PDF-1.4"], "dwg.pdf", { type: "application/pdf" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);
    await user.click(screen.getByRole("button", { name: /extract/i }));

    await waitFor(() => expect(screen.getByText("0 / 1 reconciled")).toBeInTheDocument());

    await user.type(screen.getByLabelText(/reviewing \/ signing as/i), "bob");
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(screen.getByRole("button", { name: /sign off/i })).not.toBeDisabled());
    await user.click(screen.getByRole("button", { name: /sign off/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: /export excel/i })).toBeInTheDocument());
    // override the template picked at upload for this export specifically
    await user.selectOptions(screen.getByRole("combobox", { name: /^template$/i }), "generic-flat");
    await user.click(screen.getByRole("button", { name: /export excel/i }));

    await waitFor(() => expect(screen.getByRole("link", { name: /download excel export/i })).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /download excel export/i })).toHaveAttribute(
      "href",
      "https://example/export.xlsx"
    );

    const reviewCall = vi.mocked(fetch).mock.calls[2];
    expect(reviewCall[0]).toBe("https://bdx-poc.vercel.app/api/drawings/job-1/balloons/1/12/review");
    expect(JSON.parse((reviewCall[1]?.body as string) ?? "{}")).toMatchObject({ reviewerId: "bob", action: "confirm" });

    const exportCall = vi.mocked(fetch).mock.calls[6];
    expect(exportCall[0]).toBe("https://bdx-poc.vercel.app/api/drawings/job-1/export");
    expect(JSON.parse((exportCall[1]?.body as string) ?? "{}")).toEqual({ templateId: "generic-flat" });
  });
});
