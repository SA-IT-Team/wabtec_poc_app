/**
 * Mirrors wabtec_poc/src/excel_templates.py's registry -- kept as a static list here rather than
 * fetched from GET /api/templates (which the backend still exposes) so choosing a template
 * doesn't add an extra network round-trip -- and its timing -- to every upload/export. If the
 * backend registry changes, update this list to match.
 */
export interface ExportTemplateOption {
  templateId: string;
  name: string;
}

export const EXPORT_TEMPLATES: ExportTemplateOption[] = [
  { templateId: "as9102-form3", name: "AS9102 Form 3 (characteristic accountability)" },
  { templateId: "generic-flat", name: "Generic flat characteristics list" },
];

export const DEFAULT_TEMPLATE_ID = "as9102-form3";
