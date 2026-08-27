import { useCallback, useRef, useState } from "react";
import "./UploadPanel.css";

const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/tiff"];

interface UploadPanelProps {
  disabled: boolean;
  submitting: boolean;
  onSubmit: (file: File, templateId: string) => void;
}

export function UploadPanel({ disabled, submitting, onSubmit }: UploadPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [templateId, setTemplateId] = useState("as9102-form3");
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

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    pickFile(e.dataTransfer.files[0]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    onSubmit(file, templateId);
  }

  return (
    <form className="upload-panel" onSubmit={handleSubmit}>
      <div
        className={`upload-panel__dropzone${dragActive ? " upload-panel__dropzone--active" : ""}${
          file ? " upload-panel__dropzone--filled" : ""
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        aria-label="Choose a ballooned drawing file"
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          onChange={(e) => pickFile(e.target.files?.[0])}
          hidden
        />
        {file ? (
          <>
            <span className="upload-panel__icon">🎈</span>
            <span className="upload-panel__filename">{file.name}</span>
            <span className="upload-panel__filesize">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
          </>
        ) : (
          <>
            <span className="upload-panel__icon">📐</span>
            <span>Drop a ballooned drawing here, or click to choose a file</span>
            <span className="upload-panel__hint">PDF, PNG, JPEG, or TIFF — 25 MB max</span>
          </>
        )}
      </div>

      {pickError && <p className="upload-panel__error">{pickError}</p>}

      <div className="upload-panel__row">
        <label htmlFor="templateId" className="upload-panel__template-label">
          Export template
        </label>
        <input
          id="templateId"
          type="text"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="upload-panel__template-input"
        />
        <button type="submit" className="btn btn--primary" disabled={disabled || !file || submitting}>
          {submitting ? "Extracting…" : "Extract"}
        </button>
      </div>
    </form>
  );
}
