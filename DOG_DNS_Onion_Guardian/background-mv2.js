/**
 * OnionGuard — background-mv2.js (Manifest V2 — Firefox)
 *
 * Functionally identical to the MV3 service worker but uses the MV2 API surface.
 * Firefox requires `webRequestBlocking` permission and a persistent background page.
 *
 * Same privacy guarantees:
 *   - ZERO logging, ZERO metadata retention
 *   - Only aggregate block count is persisted (never URLs, hostnames, or timestamps)
 */

"use strict";

const ONION_PATTERN = /(?:^|\.)onion$/i;
let sessionBlockCount = 0;

function interceptRequest(details) {
  let hostname;
  try {
    hostname = new URL(details.url).hostname;
  } catch {
    return {};
  }

  if (ONION_PATTERN.test(hostname)) {
    sessionBlockCount++;
    browser.storage.local.set({ totalBlocked: sessionBlockCount });
    return { cancel: true };
  }

  return {};
}

function loadBlockCount() {
  browser.storage.local.get("totalBlocked").then((result) => {
    if (result && typeof result.totalBlocked === "number") {
      sessionBlockCount = result.totalBlocked;
    }
  });
}

browser.webRequest.onBeforeRequest.addListener(
  interceptRequest,
  { urls: ["<all_urls>"] },
  ["blocking"]
);

browser.runtime.onMessage.addListener((message) => {
  if (message.type === "GET_STATUS") {
    return Promise.resolve({
      active: true,
      sessionBlocked: sessionBlockCount,
    });
  }

  if (message.type === "RESET_COUNTER") {
    sessionBlockCount = 0;
    browser.storage.local.set({ totalBlocked: 0 });
    return Promise.resolve({ ok: true });
  }
});

loadBlockCount();
