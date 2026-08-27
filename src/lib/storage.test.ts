import { beforeEach, describe, expect, it } from "vitest";
import { addHistoryEntry, clearConnectionConfig, clearHistory, loadConnectionConfig, loadHistory, saveConnectionConfig } from "./storage";
import type { HistoryEntry } from "./types";

beforeEach(() => {
  localStorage.clear();
});

describe("connection config", () => {
  it("returns null when nothing is stored", () => {
    expect(loadConnectionConfig()).toBeNull();
  });

  it("round-trips a saved config", () => {
    saveConnectionConfig({ baseUrl: "https://example.vercel.app", apiKey: "abc123" });
    expect(loadConnectionConfig()).toEqual({ baseUrl: "https://example.vercel.app", apiKey: "abc123" });
  });

  it("round-trips a localhost config, for testing against a locally-run backend", () => {
    saveConnectionConfig({ baseUrl: "http://127.0.0.1:8000", apiKey: "local-secret" });
    expect(loadConnectionConfig()).toEqual({ baseUrl: "http://127.0.0.1:8000", apiKey: "local-secret" });
  });

  it("clear removes it", () => {
    saveConnectionConfig({ baseUrl: "https://example.vercel.app", apiKey: "abc123" });
    clearConnectionConfig();
    expect(loadConnectionConfig()).toBeNull();
  });

  it("ignores malformed stored JSON rather than throwing", () => {
    localStorage.setItem("bdx-poc.connection", "{not json");
    expect(loadConnectionConfig()).toBeNull();
  });

  it("treats a partial (missing key) stored object as unconfigured", () => {
    localStorage.setItem("bdx-poc.connection", JSON.stringify({ baseUrl: "https://x" }));
    expect(loadConnectionConfig()).toBeNull();
  });

  it("reads a connection saved under the old functionKey field name", () => {
    localStorage.setItem("bdx-poc.connection", JSON.stringify({ baseUrl: "https://x", functionKey: "k", backendType: "vercel" }));
    expect(loadConnectionConfig()).toEqual({ baseUrl: "https://x", apiKey: "k" });
  });
});

function entry(jobId: string): HistoryEntry {
  return { jobId, fileName: `${jobId}.pdf`, submittedAt: new Date().toISOString(), drawingNumber: null, balloonCountMismatch: null };
}

describe("job history", () => {
  it("starts empty", () => {
    expect(loadHistory()).toEqual([]);
  });

  it("adds newest entries first", () => {
    addHistoryEntry(entry("job-1"));
    const next = addHistoryEntry(entry("job-2"));
    expect(next.map((e) => e.jobId)).toEqual(["job-2", "job-1"]);
  });

  it("de-duplicates by jobId, moving the re-added entry to the front", () => {
    addHistoryEntry(entry("job-1"));
    addHistoryEntry(entry("job-2"));
    const next = addHistoryEntry(entry("job-1"));
    expect(next.map((e) => e.jobId)).toEqual(["job-1", "job-2"]);
  });

  it("caps history length at 25 entries", () => {
    for (let i = 0; i < 30; i++) {
      addHistoryEntry(entry(`job-${i}`));
    }
    expect(loadHistory()).toHaveLength(25);
    expect(loadHistory()[0].jobId).toBe("job-29"); // most recent kept
  });

  it("clear empties history", () => {
    addHistoryEntry(entry("job-1"));
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});
