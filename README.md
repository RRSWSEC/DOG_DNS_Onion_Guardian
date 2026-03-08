.zip extension folders are how you would add extensions manually or upload to extension hosts for various browsers. The code lives inside these and you can edit them that way.  
Use these to modify the extentions and check sauce, otherwise install them from the Extensions "store" in your appropriate browser

# OnionGuard — .onion DNS Leak Prevention Extension

**OPSEC-first browser extension for Firefox, Chrome, Chromium, and Opera.**

Intercepts `.onion` hostname requests *before* they reach the OS DNS resolver, preventing your ISP from learning you attempted to resolve a Tor hidden service address.

---

## Why This Exists

When a clearnet browser (Chrome, Firefox, etc.) encounters a `.onion` URL, it sends that hostname to your system's DNS resolver. That query then travels to your ISP's DNS server — revealing that you're attempting to reach a Tor hidden service. This is an OPSEC leak even if the connection fails, because the DNS query alone is evidence of intent.

**OnionGuard cancels the request in the browser's network stack, before it ever leaves the browser process.** No DNS query is sent. Nothing reaches the OS resolver. Nothing reaches the ISP.

---

## What It Does NOT Do

- ❌ Does NOT route traffic through Tor
- ❌ Does NOT provide anonymity for clearnet browsing
- ❌ Does NOT replace the Tor Browser

**To actually access .onion services, use [Tor Browser](https://www.torproject.org/).** This extension's purpose is to prevent accidental `.onion` DNS leaks when using a clearnet browser.

---

## Privacy Guarantees

| Property | Guarantee |
|---|---|
| Request URLs logged | Never |
| Hostnames stored | Never |
| Timestamps recorded | Never |
| Metadata retained | Never |
| Counter stored | Aggregate integer only |

The block counter stores only a single integer (`totalBlocked`). No URL, hostname, timestamp, or any other request attribute is ever persisted or transmitted.

---

## Installation

### Firefox

1. Rename `manifest-firefox.json` to `manifest.json` (replace the existing one)
2. Open Firefox → `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on**
4. Select the `manifest.json` file in the extension folder
5. For permanent install: submit to [addons.mozilla.org](https://addons.mozilla.org) or use `web-ext build`

### Chrome / Chromium / Brave / Edge

1. Use the provided `manifest.json` (Manifest V3)
2. Open `chrome://extensions/`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked**
5. Select the extension folder

### Opera

1. Open `opera://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the extension folder

---

## Technical Architecture

### Interception Layer

The extension registers a `webRequest.onBeforeRequest` listener with `"blocking"` mode on `<all_urls>`. This fires **before** any network I/O occurs — before DNS resolution, before TCP connection, before TLS handshake.

```
Browser parses URL
       ↓
OnionGuard.onBeforeRequest fires  ← interception point
       ↓ (if .onion)
{ cancel: true }  → request terminated
       ↓ (if not .onion)
OS DNS resolver → ISP DNS → Internet
```

The regex used for matching: `/(?:^|\.)onion$/i`

This catches:
- `example.onion` — direct TLD
- `sub.example.onion` — subdomains
- `deep.sub.example.onion` — nested subdomains

### DeclarativeNetRequest (MV3 Fallback)

Chrome's Manifest V3 also activates a `declarativeNetRequest` ruleset as a defense-in-depth layer. This rule set blocks `.onion` patterns at the declarative level, independent of the service worker.

### Storage

Only `chrome.storage.local` / `browser.storage.local` is used, and only to persist the aggregate integer `totalBlocked`. The storage call occurs *after* the URL has been evaluated and discarded.

---

## Browser Compatibility

| Browser | Manifest | Background |
|---|---|---|
| Firefox 91+ | V2 (manifest-firefox.json) | Persistent page |
| Chrome 88+ | V3 (manifest.json) | Service worker |
| Chromium | V3 | Service worker |
| Opera 74+ | V3 | Service worker |
| Brave | V3 | Service worker |
| Edge 88+ | V3 | Service worker |

---

## Building for Distribution

### Firefox (web-ext)
```bash
npm install -g web-ext
cp manifest-firefox.json manifest.json
web-ext build --source-dir=. --artifacts-dir=dist/
```

### Chrome (zip)
```bash
zip -r dist/onionguard-chrome.zip . \
  --exclude "*.git*" --exclude "manifest-firefox.json" --exclude "dist/*" --exclude "README*"
```

---

## License

MIT — see LICENSE file.
