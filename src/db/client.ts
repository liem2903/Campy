import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
}

// Shared connection pool. Use tagged templates (sql`...`) so values are always parameterized.
export const sql = postgres(databaseUrl);
