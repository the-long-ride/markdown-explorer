(() => {
  const releaseUrl = "https://github.com/the-long-ride/markdown-explorer/releases/latest";
  const apiUrl = "https://api.github.com/repos/the-long-ride/markdown-explorer/releases/latest";
  const note = document.querySelector("#release-note");
  const buttons = [...document.querySelectorAll(".release-download")];
  const baseButtonLabels = new Map(buttons.map((button) => [button, button.textContent.trim()]));
  const downloadCountLabels = new Map(
    buttons.map((button) => {
      const label = document.createElement("span");
      label.className = "release-download-count";
      label.setAttribute("aria-live", "polite");
      button.insertAdjacentElement("afterend", label);
      return [button, label];
    })
  );
  const numberFormatter = new Intl.NumberFormat();

  const assetMatchers = {
    windows: (name) => name.endsWith(".exe"),
    macos: (name) => name.endsWith(".dmg") || name.endsWith(".zip"),
    linux: (name) => name.endsWith(".appimage") || name.endsWith(".deb")
  };

  const preferredScore = {
    windows: (name) => name.endsWith(".exe") ? 10 : 0,
    macos: (name) => name.endsWith(".dmg") ? 10 : 5,
    linux: (name) => name.endsWith(".appimage") ? 10 : 5
  };

  const pickAsset = (assets, platform) => {
    const matcher = assetMatchers[platform];
    if (!matcher) return null;

    return assets
      .filter((asset) => matcher(asset.name.toLowerCase()))
      .sort((a, b) => preferredScore[platform](b.name.toLowerCase()) - preferredScore[platform](a.name.toLowerCase()))[0] || null;
  };

  const getPlatformAssets = (assets, platform) => {
    const matcher = assetMatchers[platform];
    if (!matcher) return [];
    return assets.filter((asset) => matcher(asset.name.toLowerCase()));
  };

  const getDownloadCount = (assets) => assets.reduce((total, asset) => {
    const count = Number(asset.download_count);
    return Number.isFinite(count) ? total + count : total;
  }, 0);

  const formatDownloads = (count) => `${numberFormatter.format(count)} ${count === 1 ? "download" : "downloads"}`;

  const setFallback = (message) => {
    buttons.forEach((button) => {
      const baseLabel = baseButtonLabels.get(button) || button.textContent.trim();
      button.href = releaseUrl;
      button.textContent = baseLabel;
      button.setAttribute("aria-label", `${baseLabel}. Opens the latest GitHub Release.`);
      const countLabel = downloadCountLabels.get(button);
      if (countLabel) countLabel.textContent = "";
    });
    if (note) note.textContent = message;
  };

  fetch(apiUrl, { headers: { Accept: "application/vnd.github+json" } })
    .then((response) => {
      if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
      return response.json();
    })
    .then((release) => {
      const assets = Array.isArray(release.assets) ? release.assets : [];
      const releaseVersion = release.tag_name || release.name || "";
      let selectedDesktopDownloads = 0;
      buttons.forEach((button) => {
        const baseLabel = baseButtonLabels.get(button) || button.textContent.trim();
        const versionedLabel = releaseVersion ? `${baseLabel} ${releaseVersion}` : baseLabel;
        const platformAssets = getPlatformAssets(assets, button.dataset.platform);
        const asset = pickAsset(assets, button.dataset.platform);
        const downloads = getDownloadCount(platformAssets);
        const countLabel = downloadCountLabels.get(button);
        button.textContent = versionedLabel;
        selectedDesktopDownloads += downloads;
        if (countLabel) countLabel.textContent = downloads > 0 ? formatDownloads(downloads) : "No recorded downloads yet";

        if (!asset) {
          button.href = release.html_url || releaseUrl;
          button.setAttribute("aria-label", `${versionedLabel}. Opens the GitHub Release page.`);
          return;
        }

        button.href = asset.browser_download_url;
        button.setAttribute("aria-label", `Download ${asset.name} from GitHub Release ${releaseVersion || "latest"}`);
        button.title = asset.name;
      });

      if (note) {
        note.textContent = releaseVersion
          ? `Desktop downloads resolved from GitHub Release ${releaseVersion}. ${formatDownloads(selectedDesktopDownloads)} across matched desktop assets.`
          : "Desktop downloads resolved from the GitHub Releases API.";
      }
    })
    .catch(() => {
      setFallback("Could not read GitHub assets right now. Download buttons open the latest release page instead.");
    });
})();
