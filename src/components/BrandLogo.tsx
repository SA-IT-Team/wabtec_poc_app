import { useState } from "react";

interface BrandLogoProps {
  src: string;
  alt: string;
  /** Wrap the image in a small white card -- for a logo file with a flat (non-transparent)
   * white background, so it doesn't look like a broken cutout against the page background,
   * especially in dark mode. Leave unset for a logo with real transparency (e.g. a PNG cutout). */
  onWhiteChip?: boolean;
}

/** Renders a logo image, falling back to a plain text wordmark if the file at `src` 404s (e.g. the
 * real logo asset hasn't been dropped into public/logos/ yet) -- see App.tsx and public/logos/README.md. */
export function BrandLogo({ src, alt, onWhiteChip = false }: BrandLogoProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <span className="app__logo app__logo--fallback">{alt}</span>;
  }

  const img = <img className="app__logo" src={src} alt={alt} onError={() => setFailed(true)} />;
  return onWhiteChip ? <span className="app__logo-chip">{img}</span> : img;
}
