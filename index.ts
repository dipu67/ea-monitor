import { loadConfig } from "./config.js";
import { startMonitorLoop, stopMonitorLoop } from "./cron.js";
import { prisma } from "./db.js";
import { log } from "./util.js";

async function main() {
  await loadConfig();
  const { bot, startBot } = await import("./bot.js");

  const shutdown = async () => {
    log("Shutting down");
    stopMonitorLoop();
    await bot.stop();
    await prisma.$disconnect();
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

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
