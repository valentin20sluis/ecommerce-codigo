import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit corre fuera de Next: `.env.local` no se carga solo.
config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
