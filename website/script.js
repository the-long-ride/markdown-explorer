(() => {
  const releaseUrl = "https://github.com/the-long-ride/markdown-explorer/releases/latest";
  const apiUrl = "https://api.github.com/repos/the-long-ride/markdown-explorer/releases/latest";
  const note = document.querySelector("#release-note");
  const buttons = [...document.querySelectorAll(".release-download")];
  const baseButtonLabels = new Map(buttons.map((button) => [button, button.textContent.trim()]));

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

  const setFallback = (message) => {
    buttons.forEach((button) => {
      const baseLabel = baseButtonLabels.get(button) || button.textContent.trim();
      button.href = releaseUrl;
      button.textContent = baseLabel;
      button.setAttribute("aria-label", `${baseLabel}. Opens the latest GitHub Release.`);
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
      buttons.forEach((button) => {
        const baseLabel = baseButtonLabels.get(button) || button.textContent.trim();
        const versionedLabel = releaseVersion ? `${baseLabel} ${releaseVersion}` : baseLabel;
        const asset = pickAsset(assets, button.dataset.platform);
        button.textContent = versionedLabel;

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
          ? `Desktop downloads resolved from GitHub Release ${releaseVersion}.`
          : "Desktop downloads resolved from the GitHub Releases API.";
      }
    })
    .catch(() => {
      setFallback("Could not read GitHub assets right now. Download buttons open the latest release page instead.");
    });
})();
