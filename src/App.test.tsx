import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { ExtractionResult } from "./lib/types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function connect(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/function app url/i), "https://bdx-poc.azurewebsites.net");
  await user.type(screen.getByLabelText(/function key/i), "test-key");
  await user.click(screen.getByRole("button", { name: /save/i }));
}

describe("App", () => {
  it("prompts for connection details before allowing an upload", () => {
    render(<App />);
    expect(screen.getByLabelText(/function app url/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /extract/i })).toBeDisabled();
  });

  it("persists the connection and re-shows it collapsed on next render", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await connect(user);
    expect(screen.getByText(/bdx-poc\.azurewebsites\.net/)).toBeInTheDocument();
    unmount();

    render(<App />);
    expect(screen.getByText("● connected")).toBeInTheDocument();
    expect(screen.queryByLabelText(/function app url/i)).not.toBeInTheDocument();
  });

  it("uploads a file and renders the extraction result, including a mismatch banner", async () => {
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
      export_url: "https://example.blob.core.windows.net/exports/job-abc12345/characteristics.xlsx",
    };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(result));

    render(<App />);
    await connect(user);

    const file = new File(["%PDF-1.4"], "dwg.pdf", { type: "application/pdf" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);
    await user.click(screen.getByRole("button", { name: /extract/i }));

    await waitFor(() => expect(screen.getByText("DWG-10245")).toBeInTheDocument());
    expect(screen.getByText(/balloon count mismatch/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /download excel export/i })).toHaveAttribute("href", result.export_url!);

    // it also lands in job history
    const history = screen.getByText(/recent jobs/i).closest<HTMLElement>(".job-history")!;
    expect(within(history).getByText("dwg.pdf")).toBeInTheDocument();
  });

  it("shows a readable error message when the API call fails", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: "QualityThresholdNotMet", message: "Image resolution 72 DPI is below the minimum of 200 DPI." }, 422)
    );

    render(<App />);
    await connect(user);

    const file = new File(["x"], "scan.png", { type: "image/png" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);
    await user.click(screen.getByRole("button", { name: /extract/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent(/below the minimum of 200 DPI/);
  });
});
