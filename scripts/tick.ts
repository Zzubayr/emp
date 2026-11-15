// Runs the reminder engine once: `npm run tick`. Useful from cron when the web server's built-in timer is disabled.
import { runTick } from "../src/lib/reminders";

runTick().then((r) => {
  console.log(r);
  process.exit(0);
});
