/**
 * Report Builder field registry (§Phase4-15). Users pick from these approved fields
 * only — never arbitrary columns or raw SQL. Each source maps to a Prisma model, the
 * scope dimensions to enforce, and a typed field list with allowed operators. The
 * report engine (src/domain/report-builder.ts) builds queries from this registry
 * and always applies the caller's permission + scope.
 */
export type FieldType = "string" | "number" | "date" | "enum" | "boolean";
export const OPERATORS: Record<FieldType, string[]> = {
  string: ["contains", "eq"],
  number: ["eq", "gt", "gte", "lt", "lte"],
  date: ["gte", "lte"],
  enum: ["eq", "in"],
  boolean: ["eq"],
};

export interface ReportField { key: string; label: string; type: FieldType; aggregatable?: boolean; options?: string[]; sortable?: boolean }
export interface ReportSource {
  key: string; label: string; model: string; permission: string;
  scopeDims: ("companyId" | "brandId" | "countryId")[];
  dateField?: string; // default date field for range filters
  fields: ReportField[];
}

export const REPORT_SOURCES: ReportSource[] = [
  {
    key: "tasks", label: "Tasks", model: "task", permission: "tasks.view", scopeDims: ["brandId", "countryId"], dateField: "dueDate",
    fields: [
      { key: "title", label: "Title", type: "string", sortable: true },
      { key: "status", label: "Status", type: "enum", options: ["todo", "in_progress", "blocked", "done", "cancelled"], aggregatable: true, sortable: true },
      { key: "priority", label: "Priority", type: "enum", options: ["low", "medium", "high", "urgent"], aggregatable: true, sortable: true },
      { key: "dueDate", label: "Due date", type: "date", sortable: true },
      { key: "brandId", label: "Brand", type: "string", aggregatable: true },
      { key: "countryId", label: "Country", type: "string", aggregatable: true },
      { key: "createdAt", label: "Created", type: "date", sortable: true },
    ],
  },
  {
    key: "campaigns", label: "Campaigns", model: "campaign", permission: "campaigns.view", scopeDims: ["companyId", "brandId", "countryId"], dateField: "startDate",
    fields: [
      { key: "name", label: "Name", type: "string", sortable: true },
      { key: "status", label: "Status", type: "enum", options: ["draft", "active", "paused", "completed"], aggregatable: true, sortable: true },
      { key: "objective", label: "Objective", type: "string", aggregatable: true },
      { key: "actualSpend", label: "Actual spend", type: "number", aggregatable: true, sortable: true },
      { key: "budget", label: "Budget", type: "number", aggregatable: true, sortable: true },
      { key: "brandId", label: "Brand", type: "string", aggregatable: true },
      { key: "countryId", label: "Country", type: "string", aggregatable: true },
      { key: "startDate", label: "Start date", type: "date", sortable: true },
    ],
  },
  {
    key: "expenses", label: "Expenses", model: "expense", permission: "expenses.view", scopeDims: ["companyId", "brandId", "countryId"], dateField: "date",
    fields: [
      { key: "description", label: "Description", type: "string", sortable: true },
      { key: "amount", label: "Amount", type: "number", aggregatable: true, sortable: true },
      { key: "currency", label: "Currency", type: "enum", options: ["KWD", "SAR", "AED", "USD"], aggregatable: true },
      { key: "status", label: "Status", type: "enum", options: ["draft", "pending", "approved", "rejected", "posted", "paid"], aggregatable: true, sortable: true },
      { key: "brandId", label: "Brand", type: "string", aggregatable: true },
      { key: "countryId", label: "Country", type: "string", aggregatable: true },
      { key: "date", label: "Date", type: "date", sortable: true },
    ],
  },
  {
    key: "registrations", label: "Registrations", model: "registrationCase", permission: "registrations.view", scopeDims: ["brandId", "countryId"], dateField: "createdAt",
    fields: [
      { key: "status", label: "Status", type: "enum", options: ["draft", "submitted", "under_review", "approved", "rejected", "expired"], aggregatable: true, sortable: true },
      { key: "brandId", label: "Brand", type: "string", aggregatable: true },
      { key: "countryId", label: "Country", type: "string", aggregatable: true },
      { key: "createdAt", label: "Created", type: "date", sortable: true },
    ],
  },
];

export const SOURCE_BY_KEY = new Map(REPORT_SOURCES.map((s) => [s.key, s]));
