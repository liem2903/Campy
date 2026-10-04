import { rateLimit } from "express-rate-limit";

const message = { error: "Too many attempts, please try again later." };

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
