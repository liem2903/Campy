import { createApp } from "./app.js";

const port = process.env.PORT ? Number(process.env.PORT) : 3000;

createApp().listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
