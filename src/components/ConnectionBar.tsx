import { useState } from "react";
import type { BackendType, ConnectionConfig } from "../lib/types";
import { StatusPill } from "./StatusPill";
import "./ConnectionBar.css";

interface ConnectionBarProps {
  config: ConnectionConfig | null;
  onSave: (config: ConnectionConfig) => void;
  onClear: () => void;
}

const BACKEND_LABELS: Record<BackendType, string> = {
  azure: "Azure Functions",
  vercel: "Vercel",
};

export function ConnectionBar({ config, onSave, onClear }: ConnectionBarProps) {
  const [editing, setEditing] = useState(!config);
  const [backendType, setBackendType] = useState<BackendType>(config?.backendType ?? "azure");
  const [baseUrl, setBaseUrl] = useState(config?.baseUrl ?? "");
  const [functionKey, setFunctionKey] = useState(config?.functionKey ?? "");

  const isValid = baseUrl.trim().length > 0 && functionKey.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    onSave({ baseUrl: baseUrl.trim(), functionKey: functionKey.trim(), backendType });
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
        <span className="connection-bar__backend-tag">{BACKEND_LABELS[config.backendType]}</span>
        <button type="button" className="btn btn--ghost" onClick={() => setEditing(true)}>
          Edit
        </button>
      </div>
    );
  }

  return (
    <form className="connection-bar connection-bar--form" onSubmit={handleSubmit}>
      <div className="connection-bar__field">
        <label id="backendTypeLabel">Backend</label>
        <div className="connection-bar__segmented" role="radiogroup" aria-labelledby="backendTypeLabel">
          {(Object.keys(BACKEND_LABELS) as BackendType[]).map((type) => (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={backendType === type}
              className={`connection-bar__segment${backendType === type ? " connection-bar__segment--active" : ""}`}
              onClick={() => setBackendType(type)}
            >
              {BACKEND_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      <div className="connection-bar__field">
        <label htmlFor="baseUrl">{backendType === "vercel" ? "Vercel deployment URL" : "Function App URL"}</label>
        <input
          id="baseUrl"
          type="url"
          required
          placeholder={backendType === "vercel" ? "https://your-project.vercel.app" : "https://bdx-poc01-func.azurewebsites.net"}
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
        />
      </div>
      <div className="connection-bar__field">
        <label htmlFor="functionKey">{backendType === "vercel" ? "API access key" : "Function key"}</label>
        <input
          id="functionKey"
          type="password"
          required
          placeholder={backendType === "vercel" ? "value of API_ACCESS_KEY" : "from: az functionapp keys list"}
          value={functionKey}
          onChange={(e) => setFunctionKey(e.target.value)}
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
              setFunctionKey("");
            }}
          >
            Forget
          </button>
        )}
      </div>
      <p className="connection-bar__note">
        Stored only in this browser's local storage and sent only to the URL above — neither host
        has real user auth, just a shared secret (§3.3 of architecture-poc.md /
        deployment-vercel.md §3).
      </p>
    </form>
  );
}
