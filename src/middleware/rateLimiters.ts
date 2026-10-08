import type { Request } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";

const message = { error: "Too many attempts, please try again later." };
const fifteenMinutes = 15 * 60 * 1000;

// 5 signups per hour per IP. Tests pass a higher limit.
export function signupLimiter(limit = 5) {
  return rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    limit,
    message,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
}

// 20 login attempts per 15 minutes per IP, whatever the email: stops one IP
// from trying many accounts.
export function loginIpLimiter(limit = 20) {
  return rateLimit({
    windowMs: fifteenMinutes,
    limit,
    message,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
}

// 5 failed logins per 15 minutes per IP + email: stops password guessing on one
// account. Successful logins don't count.
export function loginEmailLimiter(limit = 5) {
  return rateLimit({
    windowMs: fifteenMinutes,
    limit,
    message,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? "")}:${emailOf(req)}`,
  });
}

// Same email in any case or padding → same bucket, matching the citext column.
function emailOf(req: Request): string {
  const { email } = req.body as { email?: unknown };
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}
