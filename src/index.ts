import { createApp } from "./app.js";
import { sql } from "./db/client.js";

const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const server = createApp().listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

// Railway sends SIGTERM on redeploy: stop accepting requests, then close the DB pool.
function shutdown(signal: string): void {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    sql.end({ timeout: 5 }).finally(() => process.exit(0));
  });
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
