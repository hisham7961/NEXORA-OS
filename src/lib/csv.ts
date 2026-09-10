/**
 * Minimal, dependency-free CSV parsing + generation (§Phase4). RFC-4180-ish:
 * handles quoted fields, embedded commas/quotes/newlines, and CRLF. Used by the
 * bank-statement import, the import framework and list/report exports so no module
 * hand-rolls its own parser.
 */

/** Parse CSV text into a matrix of string cells. Empty input → []. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/^﻿/, ""); // strip BOM
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field); field = "";
      // Skip fully-blank lines.
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length > 0) { row.push(field); if (row.length > 1 || row[0] !== "") rows.push(row); }
  return rows;
}

/** Parse CSV with a header row into objects keyed by trimmed header names. */
export function parseCsvObjects(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const matrix = parseCsv(text);
  if (matrix.length === 0) return { headers: [], rows: [] };
  const headers = matrix[0].map((h) => h.trim());
  const rows = matrix.slice(1).map((cells) => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => { o[h] = (cells[i] ?? "").trim(); });
    return o;
  });
  return { headers, rows };
}

/** Escape a single CSV cell (quote when it contains comma/quote/newline). */
export function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build CSV text from a header list and rows of cells. Rows may be arrays or objects keyed by header. */
export function toCsv(headers: string[], rows: (unknown[] | Record<string, unknown>)[]): string {
  const head = headers.map(csvCell).join(",");
  const body = rows.map((r) => {
    const cells = Array.isArray(r) ? r : headers.map((h) => (r as Record<string, unknown>)[h]);
    return cells.map(csvCell).join(",");
  });
  return [head, ...body].join("\r\n");
}
