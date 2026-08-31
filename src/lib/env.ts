/**
 * Backend connection config, supplied at build/deploy time via Vite env vars instead of typed
 * into the UI -- see .env.example (local dev) and deployment-vercel.md (Vercel project settings).
 *
 * These are read with the `VITE_` prefix Vite requires to expose a var to client code, which means
 * they're inlined into the built JS bundle at build time -- anyone with devtools access to a
 * deployed build can read VITE_API_ACCESS_KEY out of it. That's no different in practice from the
 * old localStorage-entered key (also visible to anyone with access to that browser), and this app
 * has no real user auth either way -- see wabtec_poc/doc/architecture-poc.md §3.3. It's a shared
 * secret gating casual access, not a per-user credential; treat it accordingly.
 *
 * Not memoized at module scope on purpose: Vite still inlines the literal value at build time
 * either way (a real deployment behaves identically), but calling this fresh each time lets tests
 * exercise both configured and unconfigured states with vi.stubEnv without needing a module reset.
 */
import type { ConnectionConfig } from "./types";

export function getEnvConnectionConfig(): ConnectionConfig | null {
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  const apiKey = import.meta.env.VITE_API_ACCESS_KEY?.trim();
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
}
