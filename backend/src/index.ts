import { start } from "./app.js";

start().catch((e) => {
  console.error(e);
  process.exit(1);
});
