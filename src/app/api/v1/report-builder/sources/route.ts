import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { canAnywhere } from "@/lib/permissions/engine";
import { REPORT_SOURCES, OPERATORS } from "@/lib/reports/field-registry";

export const GET = route(async ({ principal }) => {
  const sources = REPORT_SOURCES.filter((s) => canAnywhere(principal, s.permission)).map((s) => ({
    key: s.key, label: s.label, dateField: s.dateField,
    fields: s.fields.map((f) => ({ key: f.key, label: f.label, type: f.type, operators: OPERATORS[f.type], options: f.options, aggregatable: f.aggregatable, sortable: f.sortable })),
  }));
  return ok({ sources });
});
