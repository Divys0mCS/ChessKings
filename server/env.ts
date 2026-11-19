import { existsSync } from "node:fs";
import { config } from "dotenv";

// The Socket.IO process runs outside Next.js, so load the same env files here.
// Real environment variables always win over file values.
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) config({ path: file, override: false, quiet: true });
}
