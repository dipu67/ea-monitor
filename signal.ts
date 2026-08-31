import type { APITwitterStatus } from "./fxTwitter/types.js";

export type SignalKind =
  | "eth_ca"
  | "sol_ca"
  | "link"
  | "keyword"
  | "ticker"
  | "mint_date"
  | "invite";

export interface Signal {
  kind: SignalKind;
  label: string;
  value: string;
}

const ETH_CA = /0x[a-fA-F0-9]{40}/g;
const SOL_CA = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
const TICKER = /\$[A-Z]{2,10}\b/g;
const URL_RE = /https?:\/\/[^\s)]+/gi;
const ISO_DATE = /\b20\d{2}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?\b/;
const SLASH_DATE = /\b\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4}\b/;

const KEYWORDS = [
  "mint",
  "minting",
  "tge",
  "listing",
  "listed",
  "whitelist",
  "snapshot",
  "airdrop",
  "claim",
  "stealth",
  "contract",
  "presale",
  "public sale",
  "mint live",
  "now live",
  "ca live",
  "token live",
];

const ALPHA_HOSTS = [
  "pump.fun",
  "dexscreener.com",
  "birdeye.so",
  "jup.ag",
  "jupiter.ag",
  "uniswap.org",
  "raydium.io",
  "axiom.trade",
  "gmgn.ai",
  "dextools.io",
  "etherscan.io",
  "solscan.io",
  "basescan.org",
  "arbiscan.io",
  "defined.fi",
  "photon-sol.tinyastro.io",
  "bullx.io",
  "padre.gg",
  "bloom.app",
];

const INVITE_HOSTS = ["discord.gg", "discord.com/invite", "t.me/"];

function unique(values: string[]) {
  return [...new Set(values)];
}

function collectText(status: APITwitterStatus): string {
  const parts = [status.text];
  if (status.quote && "text" in status.quote && status.quote.text) {
    parts.push(status.quote.text);
  }
  if (status.card?.url) parts.push(status.card.url);
  if (status.card?.description) parts.push(status.card.description);
  if (status.card?.title) parts.push(status.card.title);
  return parts.join("\n");
}

function hostOf(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function parseMintDate(text: string): Date | null {
  const iso = text.match(ISO_DATE);
  if (iso?.[0]) {
    const parsed = new Date(iso[0].replace(" ", "T"));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const slash = text.match(SLASH_DATE);
  if (slash?.[0]) {
    const bits = slash[0].split(/[/.]/).map(Number);
    const [a, b, c] = bits;
    if (a && b && c) {
      const year = c < 100 ? 2000 + c : c;
      const month = a > 12 ? b : a;
      const day = a > 12 ? a : b;
      const parsed = new Date(Date.UTC(year, month - 1, day));
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }
  return null;
}

export function detectSignals(status: APITwitterStatus): Signal[] {
  const text = collectText(status);
  const signals: Signal[] = [];

  for (const ca of unique(text.match(ETH_CA) ?? [])) {
    signals.push({ kind: "eth_ca", label: "ETH CA", value: ca });
  }

  const ethSet = new Set(text.match(ETH_CA) ?? []);
  for (const ca of unique(text.match(SOL_CA) ?? [])) {
    if (ethSet.has(ca)) continue;
    if (/^[A-Za-z]+$/.test(ca)) continue;
    signals.push({ kind: "sol_ca", label: "SOL CA", value: ca });
  }

  const urls = unique(text.match(URL_RE) ?? []).map((u) => u.replace(/[.,;]+$/, ""));
  for (const url of urls) {
    const lower = url.toLowerCase();
    if (INVITE_HOSTS.some((h) => lower.includes(h))) {
      signals.push({ kind: "invite", label: "Invite", value: url });
      continue;
    }
    if (ALPHA_HOSTS.some((h) => lower.includes(h))) {
      signals.push({ kind: "link", label: "Link", value: url });
    }
  }

  const lower = text.toLowerCase();
  for (const keyword of KEYWORDS) {
    if (lower.includes(keyword)) {
      signals.push({ kind: "keyword", label: "Keyword", value: keyword });
    }
  }

  for (const ticker of unique(text.match(TICKER) ?? [])) {
    signals.push({ kind: "ticker", label: "Ticker", value: ticker });
  }

  if (/\bmint(?:ing)?(?:\s+date)?\b/i.test(text)) {
    const date = parseMintDate(text);
    if (date) {
      signals.push({
        kind: "mint_date",
        label: "Mint date",
        value: date.toISOString().slice(0, 10),
      });
    }
  }

  return signals;
}

export function mintDateFromSignals(signals: Signal[]): Date | null {
  const hit = signals.find((s) => s.kind === "mint_date");
  if (!hit) return null;
  const parsed = new Date(hit.value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function hasAlphaSignal(signals: Signal[]) {
  return signals.some((s) => s.kind === "eth_ca" || s.kind === "sol_ca" || s.kind === "link" || s.kind === "mint_date");
}
