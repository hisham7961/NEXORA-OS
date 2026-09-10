#!/usr/bin/env node
/**
 * Hard-coded user-facing English string detector (§49). A pragmatic guardrail — not
 * an NLP engine. It flags the two commonest ways an untranslated string sneaks into
 * the UI:
 *   1. JSX text nodes:            >Create Invoice<
 *   2. user-facing prop/field literals: title="…", description="…", placeholder="…",
 *      header: "…", label: "…", empty=…, confirm("…"), toast({ title: "…" })
 *
 * Technical strings (codes, API paths, classNames, single tokens) are skipped, and a
 * line carrying `i18n-ignore` (or `i18n-exempt`) is suppressed. Files and substrings
 * in scripts/i18n-allowlist.json are exempt. Exit code is non-zero when the finding
 * count exceeds the recorded baseline, so CI ratchets the count down and blocks new
 * hard-coded strings.
 *
 * Usage: node scripts/i18n-scan.mjs [--json] [--update-baseline]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOTS = ["src/app", "src/components"];
const ALLOWLIST_PATH = "scripts/i18n-allowlist.json";
const allow = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8"));
const exemptFiles = new Set(allow.exemptFiles ?? []);
const exemptSubstrings = allow.exemptSubstrings ?? [];

const USERFACING_PROPS = /\b(title|description|subtitle|placeholder|header|label|empty|heading|emptyLabel|confirmText|cta|hint)\s*[:=]\s*(["'])((?:(?!\2).){2,120})\2/g;
const CONFIRM = /\bconfirm\(\s*(["'])((?:(?!\1).){3,200})\1/g;
const JSX_TEXT = />\s*([A-Z][A-Za-z][^<>{}\n]{1,90})</g;

// Looks technical → skip.
function isTechnical(s) {
  const t = s.trim();
  if (t.length < 3) return true;
  if (!/[A-Za-z]/.test(t)) return true;
  if (/^[A-Z0-9_./:\-\s]+$/.test(t) && !/[a-z]/.test(t)) return true; // ALL CAPS/codes
  if (/(https?:|\/api\/|\.tsx|\.ts$|@\/|node:|process\.env|[{}]|\$\{|=>)/.test(t)) return true;
  if (/^[a-z][a-zA-Z]*(\.[a-z][a-zA-Z]*)+$/.test(t)) return true; // dotted.key or ident.chain
  if (/^[a-z]+([A-Z][a-z]+)+$/.test(t)) return true; // camelCaseIdentifier
  if (/^[\d.,%+\-*/()$€£¥ ]+$/.test(t)) return true; // numbers/symbols
  if (exemptSubstrings.some((x) => t.includes(x))) return true;
  return false;
}

function scanFile(path) {
  const src = readFileSync(path, "utf8");
  if (/i18n-file-exempt/.test(src)) return [];
  const lines = src.split("\n");
  const findings = [];
  const push = (lineIdx, kind, text) => {
    if (isTechnical(text)) return;
    if (/i18n-ignore|i18n-exempt/.test(lines[lineIdx] ?? "")) return;
    findings.push({ path, line: lineIdx + 1, kind, text: text.trim().slice(0, 80) });
  };
  lines.forEach((line, i) => {
    let m;
    USERFACING_PROPS.lastIndex = 0;
    while ((m = USERFACING_PROPS.exec(line))) push(i, "prop", m[3]);
    CONFIRM.lastIndex = 0;
    while ((m = CONFIRM.exec(line))) push(i, "confirm", m[2]);
    JSX_TEXT.lastIndex = 0;
    while ((m = JSX_TEXT.exec(line))) push(i, "jsx", m[1]);
  });
  return findings;
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (extname(p) === ".tsx" && !exemptFiles.has(p)) out.push(p);
  }
  return out;
}

const files = ROOTS.flatMap((r) => walk(r));
const all = files.flatMap(scanFile);
const byFile = {};
for (const f of all) (byFile[f.path] ??= []).push(f);

const json = process.argv.includes("--json");
if (json) { console.log(JSON.stringify({ total: all.length, byFile }, null, 2)); }
else {
  const entries = Object.entries(byFile).sort((a, b) => b[1].length - a[1].length);
  for (const [file, fs] of entries) console.log(`${String(fs.length).padStart(4)}  ${file}`);
  console.log(`\nTotal hard-coded user-facing strings: ${all.length} across ${entries.length} files`);
}

if (process.argv.includes("--update-baseline")) {
  allow.baseline = all.length;
  writeFileSync(ALLOWLIST_PATH, JSON.stringify(allow, null, 2) + "\n");
  console.log(`Baseline updated to ${all.length}`);
}

const baseline = allow.baseline ?? 0;
if (all.length > baseline) {
  console.error(`\nFAIL: ${all.length} hard-coded strings exceeds baseline ${baseline}.`);
  process.exit(1);
}
