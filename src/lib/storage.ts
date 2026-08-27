/**
 * All persistence in this app is browser localStorage -- this app has no server of its own, only
 * the wabtec_poc backend it talks to. Nothing here ever leaves the browser except via api.ts's
 * calls to that backend.
 */
import type { ConnectionConfig, HistoryEntry } from "./types";

const CONNECTION_KEY = "bdx-poc.connection";
const HISTORY_KEY = "bdx-poc.history";
const MAX_HISTORY_ENTRIES = 25;

export function loadConnectionConfig(): ConnectionConfig | null {
  try {
    const raw = localStorage.getItem(CONNECTION_KEY);
    if (!raw) return null;
    // `functionKey` is the pre-rename field name, from when this app also supported an Azure
    // Functions backend -- still read so an already-saved connection survives the upgrade.
    const parsed = JSON.parse(raw) as Partial<ConnectionConfig> & { functionKey?: string };
    const apiKey = parsed.apiKey ?? parsed.functionKey;
    if (!parsed.baseUrl || !apiKey) return null;
    return { baseUrl: parsed.baseUrl, apiKey };
  } catch {
    return null;
  }
}

export function saveConnectionConfig(config: ConnectionConfig): void {
  try {
    localStorage.setItem(CONNECTION_KEY, JSON.stringify(config));
  } catch {
    // localStorage can throw in private-browsing / storage-full situations; the app still
    // functions for the current session, it just won't remember the connection next time.
  }
}

export function clearConnectionConfig(): void {
  try {
    localStorage.removeItem(CONNECTION_KEY);
  } catch {
    /* see saveConnectionConfig */
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
    /* see saveConnectionConfig */
  }
  return next;
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* see saveConnectionConfig */
  }
}
