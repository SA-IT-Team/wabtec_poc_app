# Logo assets

Drop the real logo files here with these exact names and they'll appear in the app header
(top-left / top-right); nothing else needs to change:

- `sa-technologies.svg` (or `.png`) — SA Technologies, top left
- `wabtec.svg` (or `.png`) — Wabtec, top right

If you use `.png` instead of `.svg`, update the two `src` paths in `src/App.tsx` to match.

Until real files are added here, the header shows a plain text wordmark instead (see
`src/components/BrandLogo.tsx`) — the layout doesn't break, it just isn't branded yet.

Keep logo files reasonably small (a few hundred KB at most) and roughly landscape/square — the
header caps logo height at ~2.25rem and lets width scale naturally.
