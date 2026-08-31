# Logo assets

- `sa-technologies.jpg` — SA Technologies, top left of the app header. Flat white background (no
  transparency), so `App.tsx` renders it via `<BrandLogo onWhiteChip>`, which wraps it in a small
  white card rather than letting the white background clash with the page (especially in dark
  mode) — see `src/components/BrandLogo.tsx`.
- `wabtec.png` — Wabtec, top right. Real transparency, rendered plain (no chip).

If you swap either file for a different one, keep the filename the same (or update the `src` path
in `App.tsx` to match) and keep `onWhiteChip` in sync with whether the new file has a transparent
background.

Until a file here loads successfully, the header falls back to a plain text wordmark instead (see
`BrandLogo.tsx`) — the layout doesn't break either way.
