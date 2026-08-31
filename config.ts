import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import * as readline from "node:readline/promises";

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

const pollFromEnv = Number(process.env.POLL_INTERVAL_SEC ?? 300);

export const config = {
  databaseUrl: env("DATABASE_URL") ?? "file:./dev.db",
  fxBaseUrl: env("FXTWITTER_BASE_URL") ?? "https://api.fxtwitter.com",
  defaultPollIntervalSec: Number.isFinite(pollFromEnv) && pollFromEnv >= 15 ? pollFromEnv : 300,
  telegramToken: "",
  allowedIds: [] as string[],
};

function isToken(value: string) {
  return /^\d+:[A-Za-z0-9_-]+$/.test(value);
}

function isTelegramId(value: string) {
  return /^-?\d+$/.test(value);
}

function parseAllowedIds(raw: string) {
  return [...new Set(raw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean))];
}

async function ask(label: string): Promise<string> {
  if (!input.isTTY) {
    throw new Error(`${label.replace(/:\s*$/, "")} is not set. Add it to .env or run in an interactive terminal.`);
  }
  const rl = readline.createInterface({ input, output });
  try {
    return (await rl.question(label)).trim();
  } finally {
    rl.close();
  }
}

function writeEnvUpdates(updates: Record<string, string>) {
  const file = join(process.cwd(), ".env");
  let text = existsSync(file) ? readFileSync(file, "utf8") : "";
  if (text.length > 0 && !text.endsWith("\n")) text += "\n";

  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, "m");
    text = re.test(text) ? text.replace(re, line) : `${text}${line}\n`;
    process.env[key] = value;
  }

  writeFileSync(file, text);
}

export async function loadConfig() {
  const prompted: Record<string, string> = {};

  let telegramToken = env("TELEGRAM_BOT_TOKEN");
  if (!telegramToken) {
    telegramToken = await ask("Telegram bot token: ");
    if (telegramToken) prompted.TELEGRAM_BOT_TOKEN = telegramToken;
  }
  if (!telegramToken || !isToken(telegramToken)) {
    throw new Error("Invalid Telegram bot token. Get one from @BotFather.");
  }

  let allowedRaw = env("ALLOWED_ID");
  if (!allowedRaw) {
    allowedRaw = await ask("Allowed Telegram user ID: ");
    if (allowedRaw) prompted.ALLOWED_ID = allowedRaw;
  }
  const allowedIds = parseAllowedIds(allowedRaw);
  if (allowedIds.length === 0 || allowedIds.some((id) => !isTelegramId(id))) {
    throw new Error("Invalid ALLOWED_ID. Use your numeric Telegram user id (from @userinfobot).");
  }

  if (Object.keys(prompted).length > 0) {
    writeEnvUpdates(prompted);
  }

  config.telegramToken = telegramToken;
  config.allowedIds = allowedIds;
  return config;
}

export function isAllowedUser(userId: number | string | undefined) {
  if (userId === undefined) return false;
  return config.allowedIds.includes(String(userId));
}
