import { describe, expect, it } from "vitest";
import { DEFAULT_TEMPLATE_ID, EXPORT_TEMPLATES } from "./templates";

describe("EXPORT_TEMPLATES", () => {
  it("includes both templates the backend registers", () => {
    const ids = EXPORT_TEMPLATES.map((t) => t.templateId);
    expect(ids).toEqual(["as9102-form3", "generic-flat"]);
  });

  it("DEFAULT_TEMPLATE_ID matches one of the listed templates", () => {
    expect(EXPORT_TEMPLATES.some((t) => t.templateId === DEFAULT_TEMPLATE_ID)).toBe(true);
  });
});
