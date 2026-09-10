# NEXORA OS — Rollout & Operations Runbooks

Operational procedures for running NEXORA in production for the group. These are
day-to-day playbooks for administrators and operators — the goal (Phase 4 §0) is
that the real company can be operated safely every day **without touching the
database, seed scripts, source code, or a developer console**. Every procedure below
is either a UI action or a standard infrastructure command; none require editing data
directly.

---

## 1. Go-live for a new company

Bring a new legal company in the group live. Do this from the UI — no scripts.

1. **Create the company** (Organization → Companies): name, base currency, fiscal
   year start month, timezone.
2. **Initialize accounting** (Accounting → Settings for that company): this creates
   the standard chart of accounts, the standard journals (incl. the Opening Balance
   Journal), and the fiscal calendar. Map the control accounts (receivable, payable,
   cash) if they aren't defaulted.
3. **Assign brands & countries** the company operates (Brands / Markets).
4. **Provision users & roles** (Admin → Users): assign each user a role scoped to the
   company (and brand/country where relevant). Enforce MFA for admins/finance via
   Admin → Settings (`security.mfaRequiredForAdmins` / `…ForFinance`).
5. **Enter opening balances** (Accounting → Opening Balances): enter each account's
   debit/credit as of the go-live date; the residual balances to the chosen Opening
   Balance Equity account and posts as one entry. This is done **once** per company.
6. **Verify readiness** (Admin → Go-Live Checklist): every required item must be
   green. When it shows *Ready for go-live*, employees, finance and admins can operate
   the company.

Roll back a mistaken opening entry by reversing the opening journal (Accounting →
Journal → the OB entry → Reverse), then re-enter.

## 2. Adding a brand, country, or user later

- **Brand / country / store / product**: create from its module (Brands, Markets,
  Stores, Products). Cross-references are scalar FKs resolved for display — no
  schema change needed.
- **User**: Admin → Users → invite; assign role + scope. Access is enforced
  server-side by the permission engine, so a user sees only their scope immediately.
- **Permission changes**: Admin → Roles/Permissions. Changes take effect on the
  user's next request (sessions are not cached beyond the request).

## 3. Deployment

- **Migrations are the deployment mechanism** (never `prisma db push` in prod).
  On each release: `npm run db:deploy` (`prisma migrate deploy`) applies any new
  migrations in `prisma/migrations`, then start/restart the app.
- **First deploy** to a fresh database: `npm run setup` (generate + migrate deploy +
  seed) or run `db:deploy` then your own baseline data load.
- **Config**: set `NEXORA_SESSION_SECRET` (≥32 random chars — the app refuses to
  start in production with a weak/placeholder secret), `DATABASE_URL`,
  `NEXORA_STORAGE_DRIVER` (+ S3 vars if `s3`), and optionally `NEXORA_LOG_LEVEL`.
- **Multi-instance**: safe to run several app instances. The scheduler claims each
  job-minute in `JobRunClaim` (unique per job+minute), so scheduled jobs fire exactly
  once across the fleet. Point liveness at `/api/v1/health/live` and readiness at
  `/api/v1/health`.

## 4. Backup & restore (PostgreSQL)

- **Backup** (nightly, off-host): `pg_dump --format=custom "$DATABASE_URL" > nexora-$(date +%F).dump`
- **Object storage**: back up the blob store separately (the S3 bucket, or the
  `NEXORA_STORAGE_DIR` tree for the local driver). File rows reference opaque keys;
  DB and blobs must be backed up together to stay consistent.
- **Restore**: provision an empty database, `pg_restore --clean --if-exists -d "$DATABASE_URL" nexora-<date>.dump`, restore the blob store, then start the app.
- **Verify a restore** with the Storage integrity scan (below) — it flags any file
  rows whose blob is missing or whose checksum no longer matches.

## 5. Secret rotation

- **`NEXORA_SESSION_SECRET`**: rotating it invalidates all existing sessions (users
  re-login) and all sealed MFA secrets and webhook signing secrets (they are keyed
  from it). Consequences: MFA-enrolled users fall back to recovery codes and must
  re-enroll; webhooks must be re-created to get a new signing secret. Rotate only
  during a maintenance window and communicate the re-enrollment.
- **API tokens**: users rotate their own (Developer Portal → revoke + create). Tokens
  are independent of the session secret's hashing but their HMAC uses it — a session
  secret rotation invalidates existing API tokens too.

## 6. Monitoring & health

- **Readiness**: `GET /api/v1/health` returns 503 if the DB, object store, or this
  instance's scheduler is unhealthy — wire it to the load balancer.
- **Liveness**: `GET /api/v1/health/live` (process up only).
- **Operations Center** (Admin → System Health): job schedule, last runs, failures,
  and recent system events.
- **Logs**: structured JSON to stdout, one line per event, with a correlation id
  (`x-request-id`, echoed on responses). Filter by `level` and `requestId` in your
  aggregator. Set `NEXORA_LOG_LEVEL` (`debug|info|warn|error`).

## 7. Incident response

- **A scheduled job is failing**: Operations Center shows the last error. Re-run it
  with *Run now* after fixing the cause; runners are idempotent. A job that must be
  paused fleet-wide can be stopped by setting `NEXORA_DISABLE_SCHEDULER=1` on all
  instances (this stops *all* scheduled jobs — use only briefly).
- **Storage integrity alert** (a `health` SystemEvent for missing/corrupted files):
  run the Storage integrity scan (nightly job, or trigger it) to get the affected
  `FileVersion` ids, then restore those blobs from backup. A checksum *mismatch*
  means the stored bytes changed — treat as data corruption and restore.
- **Webhook deliveries failing**: deliveries retry with backoff up to `maxAttempts`
  before dead-lettering (status `failed`). Check the receiver; disable a noisy
  webhook from Admin → Webhooks. Signatures are `X-Nexora-Signature: sha256=HMAC(secret, body)`.
- **Suspected account compromise**: the user (or an admin) revokes the device from
  Profile → Active sessions ("sign out all other devices"), rotates their password,
  and enables MFA. Revocation cuts access on the session's next request.
- **Rate-limit or abuse**: the API rate-limiter buckets sensitive/finance paths
  tighter; 429s are expected under abuse. Investigate via the correlation id in logs.

## 8. Period close (finance)

Close an accounting period (Accounting → Periods) to lock posting into it. Posting
into a closed period is refused unless the actor holds `periods.manage`. Reversals of
entries in a closed period post into the current open period.
