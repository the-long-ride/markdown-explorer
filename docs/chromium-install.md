# Chromium Extension Installation Guide

> **Why load unpacked?** Markdown Explorer ships as an unpacked extension archive (`.zip`) alongside GitHub releases. Loading the unpacked folder in your Chromium-based browser gives you a private, offline Markdown documentation viewer with full workspace navigation.

---

## Installation Steps

### Step 1 — Download and Extract the Release

1. Go to the [Latest GitHub Release](https://github.com/the-long-ride/markdown-explorer/releases/latest) page.
2. Download the `markdown-explorer-chromium-extension-v*.zip` file.
3. Extract the downloaded `.zip` archive into a permanent folder on your computer (for example: `Documents/markdown-explorer-extension`).  
   *(Do not delete this folder after installing, as the browser loads the files directly from it).*

---

### Step 2 — Open the Browser Extensions Page

Navigate to the extension management page in your Chromium browser:

- **Google Chrome**: type `chrome://extensions` in the address bar and press **Enter**.
- **Brave Browser**: type `brave://extensions` in the address bar.
- **Microsoft Edge**: type `edge://extensions` in the address bar.
- **Opera / Vivaldi / Arc**: open **Settings** → **Extensions** (or `chrome://extensions`).

---

### Step 3 — Enable Developer Mode

Toggle the **Developer mode** switch in the top-right corner of the Extensions page to **On**.

---

### Step 4 — Load the Unpacked Extension

1. Click the **Load unpacked** button that appears in the toolbar.
2. Select the extracted folder containing the `manifest.json` file.
3. **Markdown Explorer** will now appear in your list of installed extensions.

---

### Step 5 — Enable Local File Access (Recommended for `.md` files)

To open local Markdown files directly from your disk in the browser:

1. On the `chrome://extensions` page, find **Markdown Explorer** and click **Details**.
2. Scroll down and enable **Allow access to file URLs**.
3. Pin the extension icon to your browser toolbar for quick access.

---

## Supported Browsers

| Browser | Support | Notes |
|---|---|---|
| Google Chrome | ✅ Supported | Full support (Manifest v3) |
| Brave Browser | ✅ Supported | Full support |
| Microsoft Edge | ✅ Supported | Full support |
| Vivaldi | ✅ Supported | Full support |
| Opera | ✅ Supported | Full support |
| Arc Browser | ✅ Supported | Full support via Chrome Extensions page |

---

## Privacy & Security

- **100% Offline**: All parsing, rendering, and search are local to your machine.
- **Zero Telemetry**: No tracking, analytics, or external network requests.
- **Open Source**: Full source code available at [github.com/the-long-ride/markdown-explorer](https://github.com/the-long-ride/markdown-explorer).
