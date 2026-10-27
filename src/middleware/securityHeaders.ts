import type { RequestHandler } from "express";

// What the built client may load: its own files, Google Fonts, and inline <style> tags (TipTap
// injects its base editor CSS as one). No inline scripts, no plugins, and no other site may
// frame the app, so a hidden iframe can't trick a click (clickjacking).
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

// Sent on every response, API and client files alike.
export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.set({
    "Content-Security-Policy": contentSecurityPolicy,
    // For browsers that predate frame-ancestors.
    "X-Frame-Options": "DENY",
    // Stops a browser treating a JSON reply as a script or page.
    "X-Content-Type-Options": "nosniff",
    // Note URLs hold ids; other sites get no Referer at all.
    "Referrer-Policy": "same-origin",
    // HTTPS only for a year, so a first http:// visit can't be downgraded. Browsers ignore it
    // over plain http, so local dev isn't pinned.
    "Strict-Transport-Security": "max-age=31536000",
  });
  next();
};
