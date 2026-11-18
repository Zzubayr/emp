// Runs the Prisma CLI with the database variables resolved, e.g. `tsx scripts/prisma.ts migrate deploy`.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { migrationDatabaseUrl, runtimeDatabaseUrl } from "../src/lib/db-url";

// Local runs read .env (variables already set, as on Vercel, take priority).
if (existsSync(".env")) process.loadEnvFile(".env");

const runtime = runtimeDatabaseUrl();
const migrate = migrationDatabaseUrl();
if (!runtime || !migrate) {
  console.error(
    !runtime
      ? "No database configured. Connect Supabase to this Vercel project (Storage → Supabase), or set DATABASE_URL."
      : "Migrations need Supabase's session connection (port 5432), not the transaction pooler (port 6543). Set DATABASE_URL_UNPOOLED, or connect Supabase through the Vercel integration, which sets POSTGRES_URL_NON_POOLING.",
  );
  process.exit(1);
}
const host = (s: string) => { try { return new URL(s).host; } catch { return "?"; } };
console.log(`[db] app: ${host(runtime)} · migrations: ${host(migrate)}`);
const r = spawnSync("npx", ["prisma", ...process.argv.slice(2)], { stdio: "inherit", env: { ...process.env, DATABASE_URL: runtime, DATABASE_URL_UNPOOLED: migrate } });
process.exit(r.status ?? 1);
