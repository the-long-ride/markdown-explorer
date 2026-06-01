(() => {
  const releaseUrl = "https://github.com/the-long-ride/markdown-explorer/releases/latest";
  const latestApiUrl = "https://api.github.com/repos/the-long-ride/markdown-explorer/releases/latest";
  const releasesApiUrl = "https://api.github.com/repos/the-long-ride/markdown-explorer/releases?per_page=100";
  const changelogUrl = "https://github.com/the-long-ride/markdown-explorer/blob/main/CHANGELOG.md";
  const apiHeaders = { Accept: "application/vnd.github+json" };
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

  const appendHighlightedDownloads = (target, count, suffix) => {
    const number = document.createElement("strong");
    number.className = "release-download-number";
    number.textContent = numberFormatter.format(count);
    target.append(number, document.createTextNode(` ${count === 1 ? "download" : "downloads"} ${suffix}`));
  };

  const setDownloadCountLabel = (label, count) => {
    if (!label) return;
    label.textContent = "";
    appendHighlightedDownloads(label, count, "across all versions");
  };

  const setReleaseNote = (message, downloadCount = null) => {
    if (!note) return;
    note.textContent = "";
    note.append(document.createTextNode(`${message} `));
    if (Number.isFinite(downloadCount)) {
      appendHighlightedDownloads(note, downloadCount, "across all desktop releases.");
      note.append(document.createTextNode(" "));
    }
    const link = document.createElement("a");
    link.href = changelogUrl;
    link.rel = "noopener";
    link.textContent = "See changelog on GitHub.";
    note.append(link);
  };

  const setFallback = (message) => {
    buttons.forEach((button) => {
      const baseLabel = baseButtonLabels.get(button) || button.textContent.trim();
      button.href = releaseUrl;
      button.textContent = baseLabel;
      button.setAttribute("aria-label", `${baseLabel}. Opens the latest GitHub Release.`);
      const countLabel = downloadCountLabels.get(button);
      if (countLabel) countLabel.textContent = "";
    });
    setReleaseNote(message);
  };

  const fetchJson = (url) => fetch(url, { headers: apiHeaders }).then((response) => {
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
    return response.json();
  });

  const getNextPageUrl = (linkHeader) => {
    if (!linkHeader) return "";
    const nextLink = linkHeader.split(",").find((link) => link.includes('rel="next"'));
    const match = nextLink && nextLink.match(/<([^>]+)>/);
    return match ? match[1] : "";
  };

  const fetchReleasePages = (url = releasesApiUrl, releases = []) => fetch(url, { headers: apiHeaders })
    .then((response) => {
      if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
      return response.json().then((page) => {
        const combined = releases.concat(Array.isArray(page) ? page : []);
        const nextUrl = getNextPageUrl(response.headers.get("Link"));
        return nextUrl ? fetchReleasePages(nextUrl, combined) : combined;
      });
    });

  Promise.all([fetchJson(latestApiUrl), fetchReleasePages()])
    .then(([release, releases]) => {
      const latestAssets = Array.isArray(release.assets) ? release.assets : [];
      const allReleaseAssets = releases.flatMap((item) => Array.isArray(item.assets) ? item.assets : []);
      const releaseVersion = release.tag_name || release.name || "";
      let selectedDesktopDownloads = 0;
      buttons.forEach((button) => {
        const baseLabel = baseButtonLabels.get(button) || button.textContent.trim();
        const versionedLabel = releaseVersion ? `${baseLabel} ${releaseVersion}` : baseLabel;
        const platformAssets = getPlatformAssets(allReleaseAssets, button.dataset.platform);
        const asset = pickAsset(latestAssets, button.dataset.platform);
        const downloads = getDownloadCount(platformAssets);
        const countLabel = downloadCountLabels.get(button);
        button.textContent = versionedLabel;
        selectedDesktopDownloads += downloads;
        setDownloadCountLabel(countLabel, downloads);

        if (!asset) {
          button.href = release.html_url || releaseUrl;
          button.setAttribute("aria-label", `${versionedLabel}. Opens the GitHub Release page.`);
          return;
        }

        button.href = asset.browser_download_url;
        button.setAttribute("aria-label", `Download ${asset.name} from GitHub Release ${releaseVersion || "latest"}`);
        button.title = asset.name;
      });

      setReleaseNote(
        releaseVersion
          ? `Desktop downloads resolve to GitHub Release ${releaseVersion}.`
          : "Desktop downloads resolve from the GitHub Releases API.",
        selectedDesktopDownloads
      );
    })
    .catch(() => {
      setFallback("Could not read GitHub assets right now. Download buttons open the latest release page instead.");
    });
})();
