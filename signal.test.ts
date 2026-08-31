import assert from "node:assert/strict";
import { test } from "node:test";
import { detectSignals, hasAlphaSignal } from "./signal.js";
import type { APITwitterStatus } from "./fxTwitter/types.js";

function tweet(text: string, extra: Partial<APITwitterStatus> = {}): APITwitterStatus {
  return {
    id: "1",
    url: "https://x.com/a/status/1",
    text,
    created_at: "",
    created_timestamp: 0,
    likes: 0,
    reposts: 0,
    quotes: 0,
    replies: 0,
    author: {
      type: "profile",
      id: "1",
      name: "A",
      screen_name: "a",
      description: "",
      raw_description: { text: "", facets: [] },
      location: "",
      url: "",
      protected: false,
      followers: 0,
      following: 0,
      statuses: 0,
      media_count: 0,
      likes: 0,
      joined: "",
    },
    media: {},
    raw_text: { text, display_text_range: [0, text.length], facets: [] },
    lang: "en",
    possibly_sensitive: false,
    replying_to: null,
    source: null,
    embed_card: "tweet",
    provider: "twitter",
    is_note_tweet: false,
    community_note: null,
    reposted_by: null,
    type: "status",
    ...extra,
  };
}

test("detects ethereum contract addresses", () => {
  const ca = "0x1234567890abcdef1234567890abcdef12345678";
  const signals = detectSignals(tweet(`CA: ${ca} mint live`));
  assert.ok(signals.some((s) => s.kind === "eth_ca" && s.value === ca));
  assert.ok(signals.some((s) => s.kind === "keyword" && s.value === "mint"));
  assert.equal(hasAlphaSignal(signals), true);
});

test("detects solana addresses and pump.fun links", () => {
  const ca = "So11111111111111111111111111111111111111112";
  const signals = detectSignals(tweet(`${ca} https://pump.fun/${ca}`));
  assert.ok(signals.some((s) => s.kind === "sol_ca" && s.value === ca));
  assert.ok(signals.some((s) => s.kind === "link"));
});

test("detects tickers and mint dates", () => {
  const signals = detectSignals(tweet("Mint date: 2026-09-15 $ALPHA TGE"));
  assert.ok(signals.some((s) => s.kind === "ticker" && s.value === "$ALPHA"));
  assert.ok(signals.some((s) => s.kind === "mint_date" && s.value === "2026-09-15"));
  assert.ok(signals.some((s) => s.kind === "keyword" && s.value === "tge"));
});

test("plain tweets have no alpha signal", () => {
  const signals = detectSignals(tweet("gm friends, shipping soon"));
  assert.equal(hasAlphaSignal(signals), false);
});
