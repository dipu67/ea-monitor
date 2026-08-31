import { Bot, type Context } from "grammy";
import { config, isAllowedUser } from "./config.js";
import { runMonitorOnce } from "./cron.js";
import { getSettings, prisma } from "./db.js";
import { fx } from "./fxClient.js";
import { escapeHtml, isValidUsername, normalizeUsername } from "./util.js";

export const bot = new Bot(config.telegramToken);

bot.use(async (ctx, next) => {
  if (!isAllowedUser(ctx.from?.id)) return;
  await next();
});

async function upsertSubscriber(ctx: Context) {
  if (!ctx.chat) return;
  const chatId = String(ctx.chat.id);
  const username = ctx.from?.username ?? null;
  await prisma.subscriber.upsert({
    where: { chatId },
    create: { chatId, username },
    update: { username },
  });
}

bot.command("start", async (ctx) => {
  await upsertSubscriber(ctx);
  await ctx.reply(
    [
      "<b>EA Monitor</b>",
      "Personal Twitter/X watcher for alpha projects.",
      "",
      "Add accounts, get tweet alerts, and extract contract / mint / listing signals.",
      "",
      "Try /help to see commands.",
    ].join("\n"),
    { parse_mode: "HTML" },
  );
});

bot.command("help", async (ctx) => {
  await ctx.reply(
    [
      "<b>Commands</b>",
      "/add username — watch an X account",
      "/remove username — stop watching",
      "/list — accounts being watched",
      "/check — poll now",
      "/settings — show monitor settings",
      "/settings pause | resume",
      "/settings interval 60",
      "/settings replies on | off",
    ].join("\n"),
    { parse_mode: "HTML" },
  );
});

bot.command("add", async (ctx) => {
  await upsertSubscriber(ctx);
  const username = normalizeUsername(ctx.match ?? "");
  if (!username || !isValidUsername(username)) {
    await ctx.reply("Usage: /add username");
    return;
  }

  const exist = await prisma.project.findUnique({ where: { username } });
  if (exist) {
    await ctx.reply(`Already watching @${username}`);
    return;
  }

  try {
    const res = await fx.getProfile(username);
    if (res.code !== 200 || !res.user) {
      await ctx.reply(`Could not find @${username}`);
      return;
    }

    const statuses = await fx.getProfileStatuses(res.user.screen_name);
    const data: {
      id: string;
      name: string;
      username: string;
      bio: string;
      cursor?: string;
    } = {
      id: res.user.id,
      name: res.user.name,
      username: res.user.screen_name,
      bio: res.user.description ?? "",
    };
    if (statuses?.cursor.top) data.cursor = statuses.cursor.top;

    await prisma.project.create({ data });

    const user = res.user;
    await ctx.reply(
      [
        `<b>Now watching @${escapeHtml(user.screen_name)}</b>`,
        `Name: ${escapeHtml(user.name)}`,
        `Followers: ${user.followers}`,
        `Following: ${user.following}`,
        `Tweets: ${user.statuses}`,
        "",
        "Existing tweets are skipped. New posts will be alerted here.",
      ].join("\n"),
      { parse_mode: "HTML" },
    );
  } catch (err) {
    await ctx.reply(`Failed to add @${username}`);
    console.error(err);
  }
});

bot.command("remove", async (ctx) => {
  const username = normalizeUsername(ctx.match ?? "");
  if (!username) {
    await ctx.reply("Usage: /remove username");
    return;
  }

  const exist = await prisma.project.findUnique({
    where: { username },
  });
  if (!exist) {
    await ctx.reply(`@${username} is not being watched`);
    return;
  }

  await prisma.project.delete({ where: { username: exist.username } });
  await ctx.reply(`Removed @${exist.username}`);
});

bot.command("list", async (ctx) => {
  const projects = await prisma.project.findMany({ orderBy: { username: "asc" } });
  if (projects.length === 0) {
    await ctx.reply("Nothing is being watched yet. Use /add username");
    return;
  }

  const lines = projects.map((p, i) => {
    const mint = p.mintDate ? ` · mint ${p.mintDate.toISOString().slice(0, 10)}` : "";
    return `${i + 1}. <b>${escapeHtml(p.name)}</b> · @${escapeHtml(p.username)}${mint}`;
  });
  await ctx.reply(`<b>Watching ${projects.length}</b>\n\n${lines.join("\n")}`, {
    parse_mode: "HTML",
  });
});

bot.command("check", async (ctx) => {
  await upsertSubscriber(ctx);
  await ctx.reply("Polling now…");
  await runMonitorOnce(bot);
  await ctx.reply("Poll finished.");
});

bot.command("settings", async (ctx) => {
  const arg = (ctx.match ?? "").trim().toLowerCase();
  const [action, value] = arg.split(/\s+/);

  if (action === "pause") {
    await prisma.appSettings.upsert({
      where: { id: "default" },
      create: { id: "default", paused: true },
      update: { paused: true },
    });
    await ctx.reply("Monitor paused.");
    return;
  }

  if (action === "resume") {
    await prisma.appSettings.upsert({
      where: { id: "default" },
      create: { id: "default", paused: false },
      update: { paused: false },
    });
    await ctx.reply("Monitor resumed.");
    return;
  }

  if (action === "interval") {
    const sec = Number(value);
    if (!Number.isFinite(sec) || sec < 15 || sec > 3600) {
      await ctx.reply("Interval must be between 15 and 3600 seconds.");
      return;
    }
    await prisma.appSettings.upsert({
      where: { id: "default" },
      create: { id: "default", pollIntervalSec: sec },
      update: { pollIntervalSec: sec },
    });
    await ctx.reply(`Poll interval set to ${sec}s. Takes effect on the next cycle.`);
    return;
  }

  if (action === "replies") {
    if (value !== "on" && value !== "off") {
      await ctx.reply("Usage: /settings replies on | off");
      return;
    }
    const includeReplies = value === "on";
    await prisma.appSettings.upsert({
      where: { id: "default" },
      create: { id: "default", includeReplies },
      update: { includeReplies },
    });
    await ctx.reply(`Replies ${includeReplies ? "included" : "ignored"}.`);
    return;
  }

  const settings = await getSettings();
  const count = await prisma.project.count();
  await ctx.reply(
    [
      "<b>Settings</b>",
      `Status: ${settings.paused ? "paused" : "running"}`,
      `Interval: ${settings.pollIntervalSec}s`,
      `Replies: ${settings.includeReplies ? "on" : "off"}`,
      `Projects: ${count}`,
      "",
      "/settings pause | resume",
      "/settings interval 60",
      "/settings replies on | off",
    ].join("\n"),
    { parse_mode: "HTML" },
  );
});

export async function startBot() {
  await bot.api.setMyCommands([
    { command: "start", description: "Start and subscribe to alerts" },
    { command: "help", description: "Show commands" },
    { command: "add", description: "Watch an X account" },
    { command: "remove", description: "Stop watching an account" },
    { command: "list", description: "List watched accounts" },
    { command: "check", description: "Poll for new tweets now" },
    { command: "settings", description: "View or change monitor settings" },
  ]);
  await bot.start({
    onStart: (info) => {
      console.log(`Bot @${info.username} started`);
    },
  });
}
