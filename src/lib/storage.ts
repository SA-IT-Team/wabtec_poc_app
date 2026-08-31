/**
 * All persistence in this app is browser localStorage -- this app has no server of its own, only
 * the wabtec_poc backend it talks to. Nothing here ever leaves the browser except via api.ts's
 * calls to that backend. (Backend connection config itself is no longer stored here -- it's
 * supplied at build/deploy time via env vars, see lib/env.ts.)
 */
import type { HistoryEntry } from "./types";

const HISTORY_KEY = "bdx-poc.history";
const IDENTITY_KEY = "bdx-poc.identity";
const MAX_HISTORY_ENTRIES = 25;

/** The self-declared name used as submittedBy/reviewerId/signerId across the reconciliation
 * workflow -- not authenticated, just remembered per-browser so you don't retype it constantly.
 * See ReconciliationPanel and wabtec_poc/src/reconciliation.py's module docstring. */
export function loadIdentity(): string {
  try {
    return localStorage.getItem(IDENTITY_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveIdentity(name: string): void {
  try {
    localStorage.setItem(IDENTITY_KEY, name);
  } catch {
    /* localStorage unavailable (private browsing, storage full) -- not persisting is fine this session */
  }
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function addHistoryEntry(entry: HistoryEntry): HistoryEntry[] {
  const current = loadHistory();
  const next = [entry, ...current.filter((e) => e.jobId !== entry.jobId)].slice(0, MAX_HISTORY_ENTRIES);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* localStorage unavailable (private browsing, storage full) -- not persisting is fine this session */
  }
  return next;
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* localStorage unavailable (private browsing, storage full) -- not persisting is fine this session */
  }
}
