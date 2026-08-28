import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement the Blob URL registry -- App.tsx uses createObjectURL/revokeObjectURL
// to preview the just-uploaded drawing. Stub both so component tests don't need a real browser.
if (typeof URL.createObjectURL !== "function") {
  URL.createObjectURL = () => "blob:mock-object-url";
}
if (typeof URL.revokeObjectURL !== "function") {
  URL.revokeObjectURL = () => {};
}
