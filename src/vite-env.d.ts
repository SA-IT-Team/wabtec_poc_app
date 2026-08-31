/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend base URL, e.g. https://your-backend.vercel.app or http://127.0.0.1:8000 for local
   * dev -- see src/lib/env.ts and .env.example. */
  readonly VITE_API_BASE_URL?: string;
  /** Shared secret matching the backend's API_ACCESS_KEY -- see src/lib/env.ts and .env.example. */
  readonly VITE_API_ACCESS_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
