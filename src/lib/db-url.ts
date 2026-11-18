// Works out which database to use from whichever variables the host provides:
// our own names (DATABASE_URL / DATABASE_URL_UNPOOLED), or the ones the Supabase
// and Vercel Postgres integrations set (POSTGRES_PRISMA_URL / POSTGRES_URL_NON_POOLING / POSTGRES_URL).

const first = (...names: string[]) => names.map((n) => process.env[n]?.trim()).find(Boolean);

function isTransactionPooler(u: URL) {
  return u.port === "6543";
}

/** Adds what Prisma needs on Supabase's transaction pooler: no prepared statements, one connection per function. */
export function tunePooledUrl(raw: string) {
  try {
    const u = new URL(raw);
    if (isTransactionPooler(u)) {
      if (!u.searchParams.has("pgbouncer")) u.searchParams.set("pgbouncer", "true");
      if (!u.searchParams.has("connection_limit") && process.env.VERCEL) u.searchParams.set("connection_limit", "1");
    }
    return u.toString();
  } catch {
    return raw;
  }
}

/** Connection used by the running app (pooled where available). */
export function runtimeDatabaseUrl() {
  const raw = first("DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL");
  return raw ? tunePooledUrl(raw) : undefined;
}

/** Connection used for migrations: must not be the transaction pooler. */
export function migrationDatabaseUrl() {
  const direct = first("DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING", "DIRECT_URL");
  if (direct) return direct;
  const raw = first("DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL");
  if (!raw) return undefined;
  try {
    if (isTransactionPooler(new URL(raw))) return undefined;
  } catch {}
  return raw;
}
