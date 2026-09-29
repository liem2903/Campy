import express from "express";
import path from "node:path";

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3000;
const clientDist = path.resolve("client/dist");

app.get(["/health", "/api/health"], (_req, res) => {
  res.json({ status: "ok" });
});

// Serve the built React client; fall back to index.html for client-side routes.
app.use(express.static(clientDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
