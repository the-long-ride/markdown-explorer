# macOS Installation Guide

> **Why this guide?** macOS requires apps to be notarized or code-signed by Apple before they can open without a warning. Because Markdown Explorer desktop builds are unsigned open-source releases, macOS will block the first launch with a *"cannot be opened because the developer cannot be verified"* message. Follow the steps below to open it safely.

---

## Method 1 — Right-click to Open (Recommended)

1. Download the `.dmg` file for your chip:
   - **Apple Silicon (M1/M2/M3/M4)** → download the `arm64` `.dmg`
   - **Intel Mac** → download the `x64` `.dmg`
2. Open the `.dmg` and drag **Markdown Explorer** to your **Applications** folder.
3. **Do NOT double-click** the app the first time.  
   Instead, **right-click** (or `Control + click`) the app icon → choose **Open**.
4. A dialog appears asking "Are you sure you want to open it?" — click **Open**.
5. The app is now trusted and will open normally from this point on.

---

## Method 2 — Remove the Quarantine Attribute (Terminal)

If macOS still blocks the app after Method 1, run the following command in Terminal:

```bash
xattr -dr com.apple.quarantine /Applications/Markdown\ Explorer.app
```

Then open the app normally.

---

## Method 3 — System Settings Override (macOS Ventura / Sonoma / Sequoia)

1. Try to open the app (it will be blocked).
2. Go to **System Settings** → **Privacy & Security**.
3. Scroll down to the **Security** section — you will see a message like *"Markdown Explorer was blocked from use because it is not from an identified developer."*
4. Click **Open Anyway**.
5. Enter your macOS password if prompted.

---

## Why does this happen?

Apple's **Gatekeeper** system blocks apps that are not notarized through Apple's developer program. Notarization requires a paid Apple Developer account ($99/year). Markdown Explorer is a free, open-source project and ships unsigned builds for all platforms.

The app is **100% safe** to run — you can inspect the full source code at:  
[github.com/the-long-ride/markdown-explorer](https://github.com/the-long-ride/markdown-explorer)

---

## Supported macOS Versions

| Version | Support |
|---|---|
| macOS 13 Ventura | ✅ Supported |
| macOS 14 Sonoma | ✅ Supported |
| macOS 15 Sequoia | ✅ Supported |
| macOS 12 Monterey | ⚠️ Should work, not officially tested |
| macOS 11 Big Sur or older | ❌ Not supported |

---

## Chip Compatibility

| Build | Mac Models |
|---|---|
| `arm64` (Apple Silicon) | M1, M2, M3, M4 MacBooks, Mac Minis, Mac Studios, Mac Pros |
| `x64` (Intel) | Intel MacBook Pro/Air/Mini (2019 and earlier) |

> If you're unsure which chip your Mac has, click the **Apple menu** () → **About This Mac**. It will say either "Apple M…" or "Intel Core…".
