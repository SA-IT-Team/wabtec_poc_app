/**
 * All persistence in this app is browser localStorage -- there is no backend for the app itself,
 * only the Function App it talks to. Nothing here ever leaves the browser except via api.ts's
 * calls to the configured Function App.
 */
import type { ConnectionConfig, HistoryEntry } from "./types";

const CONNECTION_KEY = "bdx-poc.connection";
const HISTORY_KEY = "bdx-poc.history";
const MAX_HISTORY_ENTRIES = 25;

export function loadConnectionConfig(): ConnectionConfig | null {
  try {
    const raw = localStorage.getItem(CONNECTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConnectionConfig>;
    if (!parsed.baseUrl || !parsed.functionKey) return null;
    return {
      baseUrl: parsed.baseUrl,
      functionKey: parsed.functionKey,
      // Defaults a connection saved before backendType existed to "azure" -- the only backend
      // this app originally supported -- so existing users don't lose their saved connection.
      backendType: parsed.backendType === "vercel" ? "vercel" : "azure",
    };
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
