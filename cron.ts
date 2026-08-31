import type { Bot } from "grammy";
import { getSettings, prisma } from "./db.js";
import { monitor } from "./monitor.js";
import { notifySubscribers, formatTweetAlert } from "./notify.js";
import { detectSignals, mintDateFromSignals } from "./signal.js";
import { log } from "./util.js";

let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;
let started = false;

async function tick(bot: Bot) {
  if (running) return;
  running = true;
  try {
    const settings = await getSettings();
    if (settings.paused) {
      log("Monitor paused");
      return;
    }
    const fresh = await monitor(settings.includeReplies);
    if (fresh.length === 0) {
      log("Poll complete — no new tweets");
      return;
    }
    log(`Poll complete — ${fresh.length} new tweet(s)`);
    for (const item of fresh) {
      const signals = detectSignals(item.tweet);
      const mintDate = mintDateFromSignals(signals);
      if (mintDate) {
        await prisma.project.update({
          where: { id: item.projectId },
          data: { mintDate },
        });
      }
      await notifySubscribers(bot, formatTweetAlert(item.tweet, signals));
    }
  } catch (err) {
    log("Monitor tick failed", err);
  } finally {
    running = false;
  }
}

async function schedule(bot: Bot) {
  const settings = await getSettings();
  const waitMs = Math.max(15, settings.pollIntervalSec) * 1000;
  timer = setTimeout(async () => {
    await tick(bot);
    if (started) await schedule(bot);
  }, waitMs);
}

export async function runMonitorOnce(bot: Bot) {
  await tick(bot);
}

export async function startMonitorLoop(bot: Bot) {
  if (started) return;
  started = true;
  log("Monitor loop starting");
  await tick(bot);
  await schedule(bot);
}

export function stopMonitorLoop() {
  started = false;
  if (timer) clearTimeout(timer);
  timer = undefined;
}
