import type { RequestHandler } from "express";

const mutating = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// CSRF defence alongside SameSite=Lax: a cross-site <form> can't send
// application/json, and fetch can't without a CORS preflight we never allow.
export const requireJson: RequestHandler = (req, res, next) => {
  if (mutating.has(req.method) && !req.is("application/json")) {
    res.status(415).json({ error: "Requests must be sent as JSON" });
    return;
  }
  next();
};
