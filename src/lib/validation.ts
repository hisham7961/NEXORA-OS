import { z } from "zod";

/** Shared zod helpers so create/edit inputs coerce form + JSON payloads consistently. */

/** Optional date: "" / null / undefined → undefined; otherwise coerced to Date. */
export const optionalDate = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.coerce.date().optional(),
);

/** Optional non-empty trimmed string. */
export const optionalString = z.preprocess(
  (v) => (typeof v === "string" ? v.trim() : v),
  z.string().min(1).optional(),
);

/** Optional decimal-ish number from a form string. */
export const optionalNumber = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.coerce.number().optional(),
);

export const optionalBool = z.preprocess(
  (v) => v === "on" || v === "true" || v === true,
  z.boolean(),
);

export const idString = z.string().min(1).max(60);
export const requiredString = (max = 200) => z.string().trim().min(1).max(max);
