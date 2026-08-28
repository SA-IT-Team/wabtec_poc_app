import "./DrawingPreview.css";

interface DrawingPreviewProps {
  url: string;
  name: string;
  type: string;
}

export function DrawingPreview({ url, name, type }: DrawingPreviewProps) {
  const isPdf = type === "application/pdf";
  const isImage = type.startsWith("image/");

  return (
    <section className="drawing-preview">
      <div className="drawing-preview__head">
        <span className="drawing-preview__title">Source drawing</span>
        <span className="drawing-preview__filename">{name}</span>
      </div>
      <div className="drawing-preview__body">
        {isImage && <img src={url} alt={`Uploaded drawing: ${name}`} className="drawing-preview__image" />}
        {isPdf && (
          <object data={url} type="application/pdf" className="drawing-preview__pdf" aria-label={`Uploaded drawing: ${name}`}>
            <p className="drawing-preview__fallback">
              This browser can't preview PDFs inline. <a href={url} target="_blank" rel="noreferrer">Open it in a new tab</a>.
            </p>
          </object>
        )}
        {!isImage && !isPdf && (
          <p className="drawing-preview__fallback">
            No inline preview for this file type. <a href={url} target="_blank" rel="noreferrer">Open it in a new tab</a>.
          </p>
        )}
      </div>
    </section>
  );
}
