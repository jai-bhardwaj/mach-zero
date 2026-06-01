/**
 * db-push-local — run `prisma db push` against the LOCAL dev database only.
 *
 * Why this exists: the Prisma CLI loads `.env`, which in this repo points at
 * SUPABASE (the shared/prod database, for migrations). Running a bare
 * `prisma db push` here therefore hits Supabase — which has happened by
 * accident. This wrapper instead loads `.env.local` (the localhost dev DB) and
 * runs the push with those URLs, so it can never touch Supabase. It refuses to
 * run if `.env.local` doesn't resolve to a localhost/127.0.0.1 database.
 *
 * Usage: npm run db:push:local
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[m[1]] = val;
  }
  return out;
}

function isLocalhost(url: string | undefined): boolean {
  if (!url) return false;
  return /@(localhost|127\.0\.0\.1)[:/]/.test(url);
}

const envLocalPath = join(process.cwd(), ".env.local");
if (!existsSync(envLocalPath)) {
  console.error("[db:push:local] .env.local not found — refusing to run (cannot confirm a local target).");
  process.exit(2);
}

const env = parseEnvFile(envLocalPath);
const dbUrl = env.DATABASE_URL;
const directUrl = env.DIRECT_DATABASE_URL ?? dbUrl;

// Hard guard: both URLs must be localhost, or we abort. This is the whole point
// of the script — never let a "local" push reach Supabase / a remote host.
if (!isLocalhost(dbUrl) || !isLocalhost(directUrl)) {
  console.error(
    "[db:push:local] .env.local DATABASE_URL/DIRECT_DATABASE_URL is NOT localhost — refusing to run.\n" +
      "  This guard exists so a 'local' push can never hit Supabase/prod.\n" +
      `  DATABASE_URL host check: ${isLocalhost(dbUrl)}, DIRECT_DATABASE_URL host check: ${isLocalhost(directUrl)}`
  );
  process.exit(2);
}

console.log("[db:push:local] pushing schema to the LOCAL dev database (localhost)…");
const result = spawnSync("npx", ["prisma", "db", "push"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: dbUrl, DIRECT_DATABASE_URL: directUrl },
});
process.exit(result.status ?? 1);
