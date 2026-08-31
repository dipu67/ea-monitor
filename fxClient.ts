import { config } from "./config.js";
import { FxTwitterClient } from "./fxTwitter/fxTwitterClient.js";

export const fx = new FxTwitterClient({
  baseUrl: config.fxBaseUrl,
  timeoutMs: 20_000,
});
