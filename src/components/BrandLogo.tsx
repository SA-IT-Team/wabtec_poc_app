import { useState } from "react";

interface BrandLogoProps {
  src: string;
  alt: string;
}

/** Renders a logo image, falling back to a plain text wordmark if the file at `src` 404s (e.g. the
 * real logo asset hasn't been dropped into public/logos/ yet) -- see App.tsx and public/logos/README.md. */
export function BrandLogo({ src, alt }: BrandLogoProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <span className="app__logo app__logo--fallback">{alt}</span>;
  }

  return <img className="app__logo" src={src} alt={alt} onError={() => setFailed(true)} />;
}
