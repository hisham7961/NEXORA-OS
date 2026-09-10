import { NextResponse, type NextRequest } from "next/server";

/**
 * Security-header middleware (§30). Injects a per-request nonce-based Content
 * Security Policy plus the standard hardening headers on every HTML/route
 * response. Next.js automatically stamps the nonce onto its own inline bootstrap
 * scripts when it sees a `'nonce-…'` in the CSP, and `strict-dynamic` lets those
 * scripts load the rest — so no `'unsafe-inline'` is needed for scripts. Styles
 * keep `'unsafe-inline'` (framework/Tailwind inject style attributes; the XSS risk
 * there is minimal). Runs in the Edge runtime, so it uses Web Crypto only.
 *
 * This sets headers; it does NOT do authorization — every page and API route still
 * enforces auth through pageGuard / route({ auth }) (defense in depth, never UI-only).
 */
export function middleware(request: NextRequest) {
  const isProd = process.env.NODE_ENV === "production";
  const nonce = btoa(crypto.randomUUID());
  // Correlation id (§41-42): reuse an inbound one (e.g. from a proxy) or mint one,
  // and echo it so a request can be traced across logs and to the client.
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${isProd ? "" : "'unsafe-eval'"}`.trim(),
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data:`,
    `font-src 'self' data:`,
    `connect-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `frame-src 'none'`,
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  // Forward the nonce to the app (Next reads it here) and echo the CSP so the
  // rendered document is governed by the same policy the browser receives.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("Content-Security-Policy", csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });

  res.headers.set("x-request-id", requestId);
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-DNS-Prefetch-Control", "off");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()");
  if (isProd) res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");

  return res;
}

export const config = {
  // Run on everything except Next's static assets and the favicon — we want the
  // CSP + hardening headers on all HTML documents and API responses.
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf)$).*)",
    },
  ],
};
