import { useCallback, useRef, useState } from "react";
import { DEFAULT_TEMPLATE_ID, EXPORT_TEMPLATES } from "../lib/templates";
import "./UploadPanel.css";

const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/tiff"];

interface UploadPanelProps {
  disabled: boolean;
  submitting: boolean;
  onSubmit: (file: File, templateId: string) => void;
}

/** A slim, button-driven upload bar -- click "Choose drawing" (or drop a file anywhere on the
 * bar) to pick a file, choose an export template, then Extract. Replaces the earlier large
 * dropzone panel with something that doesn't dominate the page above the fold. */
export function UploadPanel({ disabled, submitting, onSubmit }: UploadPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  const [dragActive, setDragActive] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pickFile = useCallback((candidate: File | undefined) => {
    if (!candidate) return;
    if (!ACCEPTED_TYPES.includes(candidate.type)) {
      setPickError(`"${candidate.name}" is a ${candidate.type || "unknown"} file. Expected PDF, PNG, JPEG, or TIFF.`);
      setFile(null);
      return;
    }
    setPickError(null);
    setFile(candidate);
  }, []);

  function handleDrop(e: React.DragEvent<HTMLFormElement>) {
    e.preventDefault();
    setDragActive(false);
    pickFile(e.dataTransfer.files[0]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    onSubmit(file, templateId);
  }

  function clearFile() {
    setFile(null);
    setPickError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <form
      className={`upload-bar${dragActive ? " upload-bar--active" : ""}`}
      onSubmit={handleSubmit}
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        onChange={(e) => pickFile(e.target.files?.[0])}
        hidden
      />

      <button type="button" className="btn upload-bar__choose" onClick={() => inputRef.current?.click()}>
        📎 Choose drawing
      </button>

      {file ? (
        <span className="upload-bar__file">
          <span className="upload-bar__filename" title={file.name}>
            {file.name}
          </span>
          <span className="upload-bar__filesize">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
          <button type="button" className="upload-bar__remove" aria-label="Remove selected file" onClick={clearFile}>
            ×
          </button>
        </span>
      ) : (
        <span className="upload-bar__hint">or drop a PDF, PNG, JPEG, or TIFF here — 25 MB max</span>
      )}

      <label className="upload-bar__template">
        <span>Export template</span>
        <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
          {EXPORT_TEMPLATES.map((t) => (
            <option key={t.templateId} value={t.templateId}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <button type="submit" className="btn btn--primary" disabled={disabled || !file || submitting}>
        {submitting ? "Extracting…" : "Extract"}
      </button>

      {pickError && <p className="upload-bar__error">{pickError}</p>}
    </form>
  );
}
