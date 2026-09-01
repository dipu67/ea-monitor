import { loadConfig } from "./config.js";
import { startMonitorLoop, stopMonitorLoop } from "./cron.js";
import { log } from "./util.js";

async function main() {
  await loadConfig();
  const { bot, startBot } = await import("./bot.js");

  const shutdown = async () => {
    log("Shutting down");
    stopMonitorLoop();
    await bot.stop();
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void shutdown();
  });
  process.once("SIGTERM", () => {
    void shutdown();
  });

  await startMonitorLoop(bot);
  await startBot();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
