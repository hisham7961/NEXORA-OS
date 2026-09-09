import { describe, it, expect } from "vitest";
import { cronMatches, nextRun, isValidCron } from "@/lib/jobs/cron";

/** §10 scheduler cron evaluator — the subset NEXORA job schedules use. */
describe("cronMatches", () => {
  const at = (y: number, mo: number, d: number, h: number, mi: number) => new Date(y, mo - 1, d, h, mi);

  it("matches a daily time '0 6 * * *'", () => {
    expect(cronMatches("0 6 * * *", at(2026, 3, 10, 6, 0))).toBe(true);
    expect(cronMatches("0 6 * * *", at(2026, 3, 10, 6, 1))).toBe(false);
    expect(cronMatches("0 6 * * *", at(2026, 3, 10, 7, 0))).toBe(false);
  });

  it("matches hourly '0 * * * *' at any hour's top of minute", () => {
    expect(cronMatches("0 * * * *", at(2026, 3, 10, 0, 0))).toBe(true);
    expect(cronMatches("0 * * * *", at(2026, 3, 10, 13, 0))).toBe(true);
    expect(cronMatches("0 * * * *", at(2026, 3, 10, 13, 30))).toBe(false);
  });

  it("supports step '*/15 * * * *'", () => {
    expect(cronMatches("*/15 * * * *", at(2026, 3, 10, 9, 0))).toBe(true);
    expect(cronMatches("*/15 * * * *", at(2026, 3, 10, 9, 15))).toBe(true);
    expect(cronMatches("*/15 * * * *", at(2026, 3, 10, 9, 20))).toBe(false);
  });

  it("supports day-of-week ranges (weekdays 'mon-fri' as 1-5)", () => {
    // 2026-03-09 is a Monday, 2026-03-14 is a Saturday.
    expect(cronMatches("0 9 * * 1-5", at(2026, 3, 9, 9, 0))).toBe(true);
    expect(cronMatches("0 9 * * 1-5", at(2026, 3, 14, 9, 0))).toBe(false);
  });

  it("supports lists '0 0,12 * * *'", () => {
    expect(cronMatches("0 0,12 * * *", at(2026, 3, 10, 0, 0))).toBe(true);
    expect(cronMatches("0 0,12 * * *", at(2026, 3, 10, 12, 0))).toBe(true);
    expect(cronMatches("0 0,12 * * *", at(2026, 3, 10, 6, 0))).toBe(false);
  });

  it("rejects malformed expressions", () => {
    expect(cronMatches("bad", new Date())).toBe(false);
    expect(cronMatches("0 6 * *", new Date())).toBe(false); // 4 fields
  });
});

describe("nextRun", () => {
  it("computes the next daily occurrence", () => {
    const from = new Date(2026, 2, 10, 6, 30); // 06:30
    const next = nextRun("0 6 * * *", from)!;
    expect(next.getHours()).toBe(6);
    expect(next.getMinutes()).toBe(0);
    expect(next.getDate()).toBe(11); // already past 06:00 today ⇒ tomorrow
  });
  it("computes the next hourly occurrence within the same hour block", () => {
    const from = new Date(2026, 2, 10, 6, 30);
    const next = nextRun("0 * * * *", from)!;
    expect(next.getHours()).toBe(7);
    expect(next.getMinutes()).toBe(0);
  });
});

describe("isValidCron", () => {
  it("accepts valid and rejects invalid", () => {
    expect(isValidCron("0 6 * * *")).toBe(true);
    expect(isValidCron("*/5 * * * *")).toBe(true);
    expect(isValidCron("nope")).toBe(false);
    expect(isValidCron("0 6 * *")).toBe(false);
  });
});
