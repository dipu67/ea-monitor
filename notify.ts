import type { Bot } from "grammy";
import { config, isAllowedUser } from "./config.js";
import { hasAlphaSignal, type Signal } from "./signal.js";
import { listSubscribers } from "./store.js";
import type { APITwitterStatus } from "./fxTwitter/types.js";
import { escapeHtml, log } from "./util.js";

function formatSignals(signals: Signal[]) {
  if (signals.length === 0) return "";
  const lines = signals.map((s) => `• ${escapeHtml(s.label)}: <code>${escapeHtml(s.value)}</code>`);
  return `\n\n<b>Signals</b>\n${lines.join("\n")}`;
}

export function formatTweetAlert(tweet: APITwitterStatus, signals: Signal[]) {
  const alpha = hasAlphaSignal(signals);
  const handle = tweet.author.screen_name;
  const name = tweet.author.name;
  const kind = tweet.reposted_by ? "repost" : tweet.replying_to ? "reply" : "tweet";
  const title = alpha ? "🚨 Alpha signal" : "🔔 New tweet";
  const text = escapeHtml(tweet.text).slice(0, 2800);
  const stats = `❤️ ${tweet.likes}  🔁 ${tweet.reposts}  💬 ${tweet.replies}`;

  return (
    `${title} · ${kind}\n` +
    `<b>${escapeHtml(name)}</b> · @${escapeHtml(handle)}\n\n` +
    `${text}` +
    formatSignals(signals) +
    `\n\n${stats}\n<a href="${escapeHtml(tweet.url)}">Open tweet</a>`
  );
}

export async function notifySubscribers(bot: Bot, html: string) {
  const subscribers = await listSubscribers();
  const chatIds = new Set([
    ...config.allowedIds,
    ...subscribers.map((s) => s.chatId).filter((id) => isAllowedUser(id)),
  ]);

  if (chatIds.size === 0) {
    log("No allowed chats to notify");
    return;
  }

  for (const chatId of chatIds) {
    try {
      await bot.api.sendMessage(chatId, html, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: false },
      });
    } catch (err) {
      log(`Failed to notify ${chatId}`, err);
    }
  }
}
