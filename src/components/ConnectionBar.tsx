import { useState } from "react";
import type { ConnectionConfig } from "../lib/types";
import { StatusPill } from "./StatusPill";
import "./ConnectionBar.css";

interface ConnectionBarProps {
  config: ConnectionConfig | null;
  onSave: (config: ConnectionConfig) => void;
  onClear: () => void;
}

export function ConnectionBar({ config, onSave, onClear }: ConnectionBarProps) {
  const [editing, setEditing] = useState(!config);
  const [baseUrl, setBaseUrl] = useState(config?.baseUrl ?? "");
  const [apiKey, setApiKey] = useState(config?.apiKey ?? "");

  const isValid = baseUrl.trim().length > 0 && apiKey.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    onSave({ baseUrl: baseUrl.trim(), apiKey: apiKey.trim() });
    setEditing(false);
  }

  if (!editing && config) {
    let host = config.baseUrl;
    try {
      host = new URL(config.baseUrl).host;
    } catch {
      /* keep raw string if not a valid URL yet */
    }
    return (
      <div className="connection-bar connection-bar--collapsed">
        <StatusPill tone="good">● connected</StatusPill>
        <span className="connection-bar__host">{host}</span>
        <button type="button" className="btn btn--ghost" onClick={() => setEditing(true)}>
          Edit
        </button>
      </div>
    );
  }

  return (
    <form className="connection-bar connection-bar--form" onSubmit={handleSubmit}>
      <div className="connection-bar__field">
        <label htmlFor="baseUrl">Backend URL</label>
        <input
          id="baseUrl"
          type="url"
          required
          placeholder="https://your-backend.vercel.app"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
        />
      </div>
      <div className="connection-bar__field">
        <label htmlFor="apiKey">API access key</label>
        <input
          id="apiKey"
          type="password"
          required
          placeholder="value of the backend's API_ACCESS_KEY"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
      </div>
      <div className="connection-bar__actions">
        <button type="submit" className="btn btn--primary" disabled={!isValid}>
          Save
        </button>
        {config && (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              onClear();
              setBaseUrl("");
              setApiKey("");
            }}
          >
            Forget
          </button>
        )}
      </div>
      <p className="connection-bar__note">
        Stored only in this browser's local storage and sent only to the URL above — the backend has
        no real user auth, just this shared secret (architecture-poc.md §3.3,
        wabtec_poc/deployment-vercel.md §3). Testing locally? Use{" "}
        <code>http://127.0.0.1:8000</code>.
      </p>
    </form>
  );
}
