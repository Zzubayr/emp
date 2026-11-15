// Runs the reminder engine once a minute inside the server process.
// Set DISABLE_TICK=true if you call /api/cron/tick from an external scheduler instead.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.DISABLE_TICK === "true") return;
  const g = globalThis as unknown as { empTick?: NodeJS.Timeout };
  if (g.empTick) return;
  const { runTick } = await import("./lib/reminders");
  let running = false;
  g.empTick = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await runTick();
    } catch (e) {
      console.error("[tick]", e);
    } finally {
      running = false;
    }
  }, 60_000);
}
