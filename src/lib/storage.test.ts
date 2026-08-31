import { beforeEach, describe, expect, it } from "vitest";
import { addHistoryEntry, clearHistory, loadHistory } from "./storage";
import type { HistoryEntry } from "./types";

beforeEach(() => {
  localStorage.clear();
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
