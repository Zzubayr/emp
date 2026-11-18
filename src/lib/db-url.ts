// The app connects with DATABASE_URL. On Supabase that is the transaction pooler (port 6543),
// which needs prepared statements off (pgbouncer=true); on serverless hosts one connection per
// function is enough. Both are added here if the copied string lacks them.

export function tunePooledUrl(raw: string) {
  try {
    const u = new URL(raw);
    if (u.port === "6543") {
      if (!u.searchParams.has("pgbouncer")) u.searchParams.set("pgbouncer", "true");
      if (!u.searchParams.has("connection_limit") && process.env.VERCEL) u.searchParams.set("connection_limit", "1");
    }
    return u.toString();
  } catch {
    return raw;
  }
}

export function runtimeDatabaseUrl() {
  const raw = process.env.DATABASE_URL?.trim();
  return raw ? tunePooledUrl(raw) : undefined;
}
