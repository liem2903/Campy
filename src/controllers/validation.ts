import { z } from "zod";

// Lowercase only, so the id we send back always equals the one the client sent.
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const INVALID_TAG_NAME = "A tag name must be 1 to 50 characters";

// Trimmed and lowercased before the length check, so "  Queue " is stored as "queue". The length
// counts characters like Postgres does ([...name] splits by code point, so an emoji counts once).
// Postgres text can't store \u0000, so a name containing it is refused rather than a 500.
export const tagNameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine((name) => [...name].length >= 1 && [...name].length <= 50 && !name.includes("\u0000"));
