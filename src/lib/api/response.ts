import { NextResponse } from "next/server";

/**
 * Consistent API response envelope (§57). Every /api/v1 endpoint returns either
 * { ok: true, data, meta? } or { ok: false, error: { code, message, details? } }.
 */
export interface ApiMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
}

export function ok<T>(data: T, meta?: ApiMeta, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data, ...(meta ? { meta } : {}) }, init);
}

export function created<T>(data: T, meta?: ApiMeta) {
  return ok(data, meta, { status: 201 });
}

export function fail(code: string, message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}
