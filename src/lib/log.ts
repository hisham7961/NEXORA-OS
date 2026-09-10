import { randomUUID } from "node:crypto";

/**
 * Structured JSON logger (§41-42). One line of JSON per event to stdout/stderr, so
 * a log aggregator can parse level, message, timestamp and arbitrary fields — no
 * more ad-hoc console strings. Use `logger.child({ requestId, userId })` to bind
 * context (e.g. a request or job run) that every subsequent line carries, so logs
 * can be correlated. Safe in the Edge runtime (no Node-only APIs beyond crypto,
 * which is only used by newRequestId()).
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL: LogLevel = (process.env.NEXORA_LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === "production" ? "info" : "debug");

type Fields = Record<string, unknown>;

function serializeError(err: unknown): Fields {
  if (err instanceof Error) return { errName: err.name, errMessage: err.message, stack: err.stack };
  return { err: String(err) };
}

function emit(level: LogLevel, base: Fields, msg: string, fields?: Fields) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;
  const record: Fields = { level, time: new Date().toISOString(), msg, ...base, ...(fields ?? {}) };
  // Expand an `err` field into structured error properties.
  if (record.err !== undefined && !("errMessage" in record)) Object.assign(record, serializeError(record.err), { err: undefined });
  const line = safeStringify(record);
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

function safeStringify(obj: Fields): string {
  try { return JSON.stringify(obj, (_k, v) => (v === undefined ? undefined : v)); }
  catch { return JSON.stringify({ level: "error", time: new Date().toISOString(), msg: "log serialization failed" }); }
}

export interface Logger {
  debug: (msg: string, fields?: Fields) => void;
  info: (msg: string, fields?: Fields) => void;
  warn: (msg: string, fields?: Fields) => void;
  error: (msg: string, fields?: Fields) => void;
  child: (fields: Fields) => Logger;
}

function make(base: Fields): Logger {
  return {
    debug: (msg, f) => emit("debug", base, msg, f),
    info: (msg, f) => emit("info", base, msg, f),
    warn: (msg, f) => emit("warn", base, msg, f),
    error: (msg, f) => emit("error", base, msg, f),
    child: (f) => make({ ...base, ...f }),
  };
}

/** The root logger. Prefer `logger.child({...})` to bind request/job context. */
export const logger = make({});

/** A fresh correlation id for a request or job run. */
export function newRequestId(): string {
  return randomUUID();
}
