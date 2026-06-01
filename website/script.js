(() => {
  const releaseUrl = "https://github.com/the-long-ride/markdown-explorer/releases/latest";
  const apiUrl = "https://api.github.com/repos/the-long-ride/markdown-explorer/releases/latest";
  const note = document.querySelector("#release-note");
  const buttons = [...document.querySelectorAll(".release-download")];

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
      button.href = releaseUrl;
      button.setAttribute("aria-label", `${button.textContent}. Opens the latest GitHub Release.`);
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
      buttons.forEach((button) => {
        const asset = pickAsset(assets, button.dataset.platform);
        if (!asset) {
          button.href = release.html_url || releaseUrl;
          button.setAttribute("aria-label", `${button.textContent}. Opens the latest GitHub Release.`);
          return;
        }

        button.href = asset.browser_download_url;
        button.setAttribute("aria-label", `Download ${asset.name}`);
        button.title = asset.name;
      });

      if (note) {
        const tag = release.tag_name ? ` ${release.tag_name}` : "";
        note.textContent = `Desktop buttons are using the latest GitHub Release${tag}.`;
      }
    })
    .catch(() => {
      setFallback("Could not read GitHub assets right now. Download buttons open the latest release page instead.");
    });
})();
