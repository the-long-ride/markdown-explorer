window.MdeSiteDownloadHelpers = (() => {
const DOWNLOAD_ICON_SVG =
    '<svg class="download-button-icon" xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision" text-rendering="geometricPrecision" image-rendering="optimizeQuality" fill-rule="evenodd" clip-rule="evenodd" viewBox="0 0 512 437.242" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="nonzero" d="M.723 313.756c-2.482-10.26 1.698-18.299 8.38-23.044a23.417 23.417 0 018.018-3.632c2.877-.7 5.88-.865 8.764-.452 8.127 1.166 15.534 6.417 18.013 16.677a632.525 632.525 0 014.317 19.091c1.566 7.418 2.52 12.234 3.418 16.772 4.445 22.443 7.732 36.512 16.021 43.526 8.775 7.423 25.366 9.985 57.167 9.985h268.042c29.359 0 44.674-2.807 52.736-10.093 7.768-7.023 10.805-20.735 14.735-41.777l.007-.043a1038.93 1038.93 0 013.426-17.758c1.298-6.427 2.722-13.029 4.34-19.703 2.484-10.256 9.886-15.503 18.008-16.677 2.861-.41 5.846-.242 8.722.449 2.905.699 5.679 1.935 8.068 3.633 6.672 4.741 10.843 12.762 8.38 22.997l-.011.044a494.136 494.136 0 00-3.958 17.974c-1.011 5.023-2.169 11.215-3.281 17.178l-.008.043c-5.792 31.052-10.544 52.357-26.462 67.319-15.681 14.741-40.245 20.977-84.699 20.977H124.823c-46.477 0-72.016-5.596-88.445-20.144-16.834-14.909-21.937-36.555-28.444-69.403-1.316-6.654-2.582-13.005-3.444-17.126-1.213-5.781-2.461-11.434-3.767-16.813zm165.549-143.439l65.092 68.466.204-160.91h47.595l-.204 160.791 66.774-70.174 34.53 32.848-125.184 131.556-123.336-129.729 34.529-32.848zm65.325-115.413l.028-22.041h47.594l-.028 22.041h-47.594zm.046-36.254L231.666 0h47.595l-.024 18.65h-47.594z"/></svg>';
  const hasPrefix = (name, prefix) => name.startsWith(`${prefix}-`);
  const isElectronAsset = (name) => hasPrefix(name, "electron");
  const isTauriAsset = (name) => hasPrefix(name, "tauri");
  const isLegacyDesktopAsset = (name) =>
    name.startsWith("markdown.explorer") ||
    name.startsWith("markdown-explorer-desktop") ||
    name.startsWith("markdown explorer");
  const isElectronLikeAsset = (name) =>
    isElectronAsset(name) || isLegacyDesktopAsset(name);

  const assetMatchers = {
    "windows-nsis": (name) =>
      isElectronLikeAsset(name) &&
      (name.includes("setup") || /\.\\d+\\.\\d+\\.\\d+\\.exe$/.test(name)) &&
      name.endsWith(".exe"),
    "windows-portable": (name) =>
      isElectronLikeAsset(name) &&
      !name.includes("setup") &&
      !/\.\\d+\\.\\d+\\.\\d+\\.exe$/.test(name) &&
      name.endsWith(".exe"),
    "macos-arm64": (name) =>
      isElectronLikeAsset(name) &&
      name.endsWith(".dmg") &&
      name.includes("arm64"),
    "macos-x64": (name) =>
      isElectronLikeAsset(name) &&
      name.endsWith(".dmg") &&
      (name.includes("x64") || !name.includes("arm64")),
    "linux-appimage": (name) =>
      isElectronLikeAsset(name) && name.endsWith(".appimage"),
    "linux-deb": (name) => isElectronLikeAsset(name) && name.endsWith(".deb"),
    "tauri-windows": (name) => isTauriAsset(name) && name.endsWith(".exe"),
    "tauri-linux-appimage": (name) =>
      isTauriAsset(name) && name.endsWith(".appimage"),
    "tauri-linux-deb": (name) => isTauriAsset(name) && name.endsWith(".deb"),
    "tauri-macos": (name) => isTauriAsset(name) && name.endsWith(".dmg"),
    chromium: (name) =>
      name.endsWith("-chromium.zip") ||
      name.endsWith("-chrome.zip") ||
      (name.includes("chromium") && name.endsWith(".zip")),
  };

  const platformGroup = {
    "windows-nsis": "windows",
    "windows-portable": "windows",
    "macos-arm64": "macos",
    "macos-x64": "macos",
    "linux-appimage": "linux",
    "linux-deb": "linux",
    "tauri-windows": "windows",
    "tauri-linux-appimage": "linux",
    "tauri-linux-deb": "linux",
    "tauri-macos": "macos",
  };

  const getCountKey = (platform) => platformGroup[platform] || platform;

  const preferredScore = {
    "windows-nsis": () => 10,
    "windows-portable": () => 10,
    "macos-arm64": () => 10,
    "macos-x64": () => 10,
    "linux-appimage": () => 10,
    "linux-deb": () => 10,
    "tauri-windows": () => 10,
    "tauri-linux-appimage": () => 10,
    "tauri-linux-deb": () => 10,
    "tauri-macos": () => 10,
    chromium: (name) => (name.includes("chromium") ? 10 : 5),
  };

  const fallbackMatchers = {
    "macos-arm64": (name) =>
      isElectronLikeAsset(name) && name.endsWith(".dmg") && name.includes("arm64"),
    "macos-x64": (name) =>
      isElectronLikeAsset(name) &&
      name.endsWith(".dmg") &&
      !name.includes("arm64"),
  };

  const pickAsset = (assets, platform) => {
    const matcher = assetMatchers[platform];
    if (!matcher) return null;
    const exact = assets
      .filter((asset) => matcher(asset.name.toLowerCase()))
      .sort(
        (a, b) =>
          preferredScore[platform](b.name.toLowerCase()) -
          preferredScore[platform](a.name.toLowerCase()),
      );
    if (exact.length > 0) return exact[0];
    const fb = fallbackMatchers[platform];
    if (fb) {
      return assets.filter((asset) => fb(asset.name.toLowerCase()))[0] || null;
    }
    return null;
  };

  const getPlatformAssets = (assets, platform) => {
    const matcher = assetMatchers[platform];
    if (!matcher) return [];
    const direct = assets.filter((asset) => matcher(asset.name.toLowerCase()));
    const group = platformGroup[platform];
    if (group) {
      const siblingKeys = Object.keys(platformGroup).filter(
        (key) => key !== platform && platformGroup[key] === group,
      );
      const siblings = siblingKeys.flatMap((key) => {
        const siblingMatcher = assetMatchers[key];
        return siblingMatcher
          ? assets.filter((asset) => siblingMatcher(asset.name.toLowerCase()))
          : [];
      });
      const seen = new Set(direct.map((asset) => asset.id));
      for (const asset of siblings) {
        if (!seen.has(asset.id)) {
          direct.push(asset);
          seen.add(asset.id);
        }
      }
    }
    return direct;
  };

  const getDownloadCount = (assets) =>
    assets.reduce((total, asset) => {
      const count = Number(asset.download_count);
      return Number.isFinite(count) ? total + count : total;
    }, 0);
  return { DOWNLOAD_ICON_SVG, hasPrefix, isElectronAsset, isTauriAsset, isLegacyDesktopAsset, isElectronLikeAsset, assetMatchers, platformGroup, getCountKey, preferredScore, fallbackMatchers, pickAsset, getPlatformAssets, getDownloadCount };
})();

