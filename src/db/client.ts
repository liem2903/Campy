import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

export const sql = postgres(url);
// Repositories take this as their last parameter so services can pass a transaction.
export type Db = postgres.Sql | postgres.TransactionSql;
