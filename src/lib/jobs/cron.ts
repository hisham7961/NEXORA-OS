/**
 * Minimal 5-field cron evaluator (§10). Supports the subset NEXORA schedules use:
 * wildcard, step (slash-n), range (a-b), list (a,b,c) and specific values, on
 * minute / hour / day-of-month / month / day-of-week (0=Sunday). No dependency,
 * fully unit-testable. Evaluated in the server's local time.
 */

function parseField(field: string, min: number, max: number): Set<number> {
  const out = new Set<number>();
  for (const part of field.split(",")) {
    let step = 1;
    let range = part;
    const slash = part.indexOf("/");
    if (slash !== -1) {
      step = parseInt(part.slice(slash + 1), 10) || 1;
      range = part.slice(0, slash);
    }
    let lo = min;
    let hi = max;
    if (range !== "*") {
      const dash = range.indexOf("-");
      if (dash !== -1) {
        lo = parseInt(range.slice(0, dash), 10);
        hi = parseInt(range.slice(dash + 1), 10);
      } else {
        lo = hi = parseInt(range, 10);
      }
    }
    if (Number.isNaN(lo) || Number.isNaN(hi)) continue;
    for (let v = lo; v <= hi; v += step) if (v >= min && v <= max) out.add(v);
  }
  return out;
}

/** True if `date` (to the minute) satisfies the cron expression. */
export function cronMatches(expr: string, date: Date): boolean {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  const [min, hour, dom, mon, dow] = fields;
  const minutes = parseField(min, 0, 59);
  const hours = parseField(hour, 0, 23);
  const doms = parseField(dom, 1, 31);
  const mons = parseField(mon, 1, 12);
  const dows = parseField(dow, 0, 6);

  if (!minutes.has(date.getMinutes())) return false;
  if (!hours.has(date.getHours())) return false;
  if (!mons.has(date.getMonth() + 1)) return false;
  // Standard cron: if BOTH day-of-month and day-of-week are restricted, either match fires.
  const domRestricted = dom !== "*";
  const dowRestricted = dow !== "*";
  const domOk = doms.has(date.getDate());
  const dowOk = dows.has(date.getDay());
  if (domRestricted && dowRestricted) return domOk || dowOk;
  if (domRestricted) return domOk;
  if (dowRestricted) return dowOk;
  return true;
}

/** The next minute at or after `from` that matches the expression (scans up to ~1 year). */
export function nextRun(expr: string, from: Date = new Date()): Date | null {
  const d = new Date(from);
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);
  for (let i = 0; i < 366 * 24 * 60; i++) {
    if (cronMatches(expr, d)) return new Date(d);
    d.setMinutes(d.getMinutes() + 1);
  }
  return null;
}

/** Validate a 5-field cron expression shape. */
export function isValidCron(expr: string): boolean {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  try {
    parseField(fields[0], 0, 59);
    parseField(fields[1], 0, 23);
    parseField(fields[2], 1, 31);
    parseField(fields[3], 1, 12);
    parseField(fields[4], 0, 6);
    return true;
  } catch {
    return false;
  }
}
