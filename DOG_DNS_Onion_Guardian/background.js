/**
 * OnionGuard — background.js (Manifest V3 Service Worker)
 *
 * Intercepts ALL network requests before DNS resolution occurs.
 * Any request whose hostname ends in `.onion` (or contains `.onion.` as a subdomain)
 * is cancelled immediately — it never reaches the OS resolver, never hits the ISP.
 *
 * Design principles:
 *   - ZERO logging: no console.log in production, no request data stored
 *   - ZERO metadata: blocked URL details are discarded immediately after incrementing counter
 *   - Counter stored only as an aggregate integer — no URLs, no timestamps, no hostnames
 *   - Extension state is in-memory only; chrome.storage used solely for the aggregate block count
 */

"use strict";

// ─── Constants ────────────────────────────────────────────────────────────────

const ONION_PATTERN = /(?:^|\.)onion$/i;

// In-memory session counter — never persisted with request details
let sessionBlockCount = 0;

// ─── Request Interception ─────────────────────────────────────────────────────

/**
 * Fires before ANY request is sent — before OS DNS resolution.
 * Returns {cancel: true} for .onion targets; undefined (allow) for everything else.
 *
 * @param {object} details - webRequest details object (URL only used transiently)
 * @returns {{cancel: boolean} | undefined}
 */
function interceptRequest(details) {
  let hostname;

  try {
    hostname = new URL(details.url).hostname;
  } catch {
    // Malformed URL — let the browser handle it normally
    return undefined;
  }

  if (ONION_PATTERN.test(hostname)) {
    // Increment session counter, then immediately discard hostname
    sessionBlockCount++;

    // Persist ONLY the aggregate count — never the hostname or URL
    persistBlockCount(sessionBlockCount);

    // Cancel — this prevents DNS resolution entirely
    return { cancel: true };
  }

  return undefined;
}

// ─── Storage (aggregate counter only) ────────────────────────────────────────

/**
 * Persists only the total block count as a single integer.
 * No hostnames, no URLs, no timestamps, no request metadata.
 *
 * @param {number} count
 */
function persistBlockCount(count) {
  chrome.storage.local.set({ totalBlocked: count });
}

/**
 * Loads persisted block count on startup to continue the session total.
 */
function loadBlockCount() {
  chrome.storage.local.get("totalBlocked", (result) => {
    if (result && typeof result.totalBlocked === "number") {
      sessionBlockCount = result.totalBlocked;
    }
  });
}

// ─── Message Handler (popup communication) ───────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_STATUS") {
    sendResponse({
      active: true,
      sessionBlocked: sessionBlockCount,
    });
    return true;
  }

  if (message.type === "RESET_COUNTER") {
    sessionBlockCount = 0;
    chrome.storage.local.set({ totalBlocked: 0 });
    sendResponse({ ok: true });
    return true;
  }
});

// ─── Lifecycle ────────────────────────────────────────────────────────────────

// Register the blocking listener — must happen synchronously at top level
chrome.webRequest.onBeforeRequest.addListener(
  interceptRequest,
  { urls: ["<all_urls>"] },
  ["blocking"]
);

// Load prior count on service worker startup
loadBlockCount();
