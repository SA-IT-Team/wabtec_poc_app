import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantPanel } from "./AssistantPanel";
import type { AnalysisReport, ConnectionConfig } from "../lib/types";

const CONFIG: ConnectionConfig = { baseUrl: "https://bdx-poc.vercel.app", apiKey: "test-secret" };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AssistantPanel", () => {
  it("shows the feedback tab by default with a prompt to run analysis", () => {
    render(<AssistantPanel jobId="job-1" config={CONFIG} />);
    expect(screen.getByRole("tab", { name: /feedback/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(/run a check for missing information/i)).toBeInTheDocument();
  });

  it("runs analysis and renders the report's summary and findings", async () => {
    const report: AnalysisReport = {
      job_id: "job-1",
      generated_at: "2026-08-28T00:00:00Z",
      summary: "One balloon needs a second look.",
      findings: [
        {
          category: "incomplete_data",
          severity: "warning",
          summary: "Balloon 1 was extracted with low confidence (40%)",
          detail: "Below the 70% threshold this build treats as reliable.",
          balloon_refs: [{ page: 1, balloon_number: 1 }],
          source: "rule",
        },
      ],
    };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(report));
    const user = userEvent.setup();

    render(<AssistantPanel jobId="job-1" config={CONFIG} />);
    await user.click(screen.getByRole("button", { name: /run analysis/i }));

    await waitFor(() => expect(screen.getByText("One balloon needs a second look.")).toBeInTheDocument());
    expect(screen.getByText(/low confidence \(40%\)/)).toBeInTheDocument();
    expect(screen.getByText("#1 (p.1)")).toBeInTheDocument();
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://bdx-poc.vercel.app/api/drawings/job-1/analyze");
    expect(init?.method).toBe("POST");
  });

  it("shows an error when analysis fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: "ExtractionServiceError", message: "Claude structured chat call failed: timeout" }, 502)
    );
    const user = userEvent.setup();

    render(<AssistantPanel jobId="job-1" config={CONFIG} />);
    await user.click(screen.getByRole("button", { name: /run analysis/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });

  it("switches to the chat tab and sends a message, rendering the reply", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ reply: "Balloon 1 is 25.4mm." }));
    const user = userEvent.setup();

    render(<AssistantPanel jobId="job-1" config={CONFIG} />);
    await user.click(screen.getByRole("tab", { name: /ask a question/i }));
    await user.type(screen.getByLabelText(/message/i), "What's balloon 1?");
    await user.click(screen.getByRole("button", { name: /^send$/i }));

    expect(screen.getByText("What's balloon 1?")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Balloon 1 is 25.4mm.")).toBeInTheDocument());

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://bdx-poc.vercel.app/api/drawings/job-1/chat");
    expect(JSON.parse(init?.body as string)).toEqual({ message: "What's balloon 1?", history: [] });
  });

  it("resends prior turns as history on a second message", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ reply: "It's 25.4mm." }))
      .mockResolvedValueOnce(jsonResponse({ reply: "And balloon 2 is 10mm." }));
    const user = userEvent.setup();

    render(<AssistantPanel jobId="job-1" config={CONFIG} />);
    await user.click(screen.getByRole("tab", { name: /ask a question/i }));

    await user.type(screen.getByLabelText(/message/i), "balloon 1?");
    await user.click(screen.getByRole("button", { name: /^send$/i }));
    await waitFor(() => expect(screen.getByText("It's 25.4mm.")).toBeInTheDocument());

    await user.type(screen.getByLabelText(/message/i), "and balloon 2?");
    await user.click(screen.getByRole("button", { name: /^send$/i }));
    await waitFor(() => expect(screen.getByText("And balloon 2 is 10mm.")).toBeInTheDocument());

    const [, secondInit] = vi.mocked(fetch).mock.calls[1];
    expect(JSON.parse(secondInit?.body as string).history).toEqual([
      { role: "user", content: "balloon 1?" },
      { role: "assistant", content: "It's 25.4mm." },
    ]);
  });
});
