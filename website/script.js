(() => {
  /* ── i18n dictionary ───────────────────────────────────────────── */
  const LANGS = window.LANGS;

  /* ── State ────────────────────────────────────────────────────── */
  const LS_THEME = "mde-site-theme";
  const LS_LANG = "mde-site-lang";
  const html = document.documentElement;

  let currentLang = localStorage.getItem(LS_LANG) || "en";
  if (!LANGS[currentLang]) currentLang = "en";

  /* ── Theme logic ──────────────────────────────────────────────── */
  const savedTheme = localStorage.getItem(LS_THEME) || "dark";
  html.setAttribute("data-theme", savedTheme);

  const themeBtn = document.getElementById("theme-btn");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const next =
        html.getAttribute("data-theme") === "dark" ? "light" : "dark";
      html.setAttribute("data-theme", next);
      localStorage.setItem(LS_THEME, next);
    });
  }

  /* ── Language logic ───────────────────────────────────────────── */
  const langBtn = document.getElementById("lang-btn");
  const langMenu = document.getElementById("lang-menu");
  const langLabel = document.getElementById("lang-label");

  const applyLang = (lang) => {
    currentLang = lang;
    localStorage.setItem(LS_LANG, lang);
    const t = LANGS[lang];
    if (!t) return;
    langLabel.textContent = t.label;
    html.setAttribute("lang", lang);
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (t[key] !== undefined) el.textContent = t[key];
    });
    // Mark active in menu
    document.querySelectorAll(".lang-menu button[data-lang]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.lang === lang);
    });
  };

  if (langBtn && langMenu) {
    langBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      langMenu.hidden = !langMenu.hidden;
    });

    langMenu.querySelectorAll("button[data-lang]").forEach((btn) => {
      btn.addEventListener("click", () => {
        applyLang(btn.dataset.lang);
        syncButtonDecorations();
        langMenu.hidden = true;
      });
    });

    document.addEventListener("click", (e) => {
      if (!langMenu.contains(e.target) && e.target !== langBtn) {
        langMenu.hidden = true;
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") langMenu.hidden = true;
    });
  }
  /* ── Demo dropdown ─────────────────────────────────────────────── */
  const demoBtn = document.getElementById("demo-btn");
  const demoMenu = document.getElementById("demo-menu");
  if (demoBtn && demoMenu) {
    const closeDemoMenu = () => {
      demoMenu.hidden = true;
      demoMenu.removeAttribute("data-open");
      demoBtn.setAttribute("aria-expanded", "false");
      demoBtn.classList.remove("is-open");
    };

    const positionDemoMenu = () => {
      const rect = demoBtn.getBoundingClientRect();
      const menuWidth = Math.max(rect.width, 168);
      const viewportPadding = 12;
      const maxLeft = window.innerWidth - menuWidth - viewportPadding;
      const left = Math.min(
        Math.max(rect.left, viewportPadding),
        Math.max(viewportPadding, maxLeft),
      );

      demoMenu.style.minWidth = `${menuWidth}px`;
      demoMenu.style.top = `${rect.bottom + 6}px`;
      demoMenu.style.left = `${left}px`;
    };

    const openDemoMenu = () => {
      demoMenu.hidden = false;
      demoMenu.dataset.open = "true";
      positionDemoMenu();
      demoBtn.setAttribute("aria-expanded", "true");
      demoBtn.classList.add("is-open");
    };

    demoBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (demoMenu.hidden) {
        openDemoMenu();
        return;
      }
      closeDemoMenu();
    });
    demoMenu.querySelectorAll("a[role='menuitem']").forEach((link) => {
      link.addEventListener("click", () => {
        closeDemoMenu();
      });
    });
    document.addEventListener("click", (e) => {
      if (demoMenu.hidden) return;
      if (!demoMenu.contains(e.target) && e.target !== demoBtn) {
        closeDemoMenu();
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !demoMenu.hidden) {
        closeDemoMenu();
      }
    });
    window.addEventListener("resize", () => {
      if (!demoMenu.hidden) positionDemoMenu();
    });
    window.addEventListener("scroll", () => {
      if (!demoMenu.hidden) positionDemoMenu();
    });
  }

  /* ── GitHub release download logic ───────────────────────────── */
  const releaseUrl =
    "https://github.com/the-long-ride/markdown-explorer/releases/latest";
  const latestApiUrl =
    "https://api.github.com/repos/the-long-ride/markdown-explorer/releases/latest";
  const releasesApiUrl =
    "https://api.github.com/repos/the-long-ride/markdown-explorer/releases?per_page=100";
  const openVsxApiUrl =
    "https://open-vsx.org/api/the-long-ride/vscode-extension-markdown-explorer";
  const marketplaceApiUrl =
    "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery";
  const changelogUrl =
    "https://github.com/the-long-ride/markdown-explorer/blob/main/CHANGELOG.md";
  const apiHeaders = { Accept: "application/vnd.github+json" };
  const note = document.querySelector("#release-note");
  const releaseButtons = [...document.querySelectorAll(".release-download")];
  const marketplaceButtons = [
    ...document.querySelectorAll(".marketplace-download"),
  ];
  const buttons = [...releaseButtons, ...marketplaceButtons];
  const baseButtonLabels = new Map(
    buttons.map((button) => [button, button.textContent.trim()]),
  );
  const downloadCountLabels = new Map(
    [...new Set(buttons.map((button) => button.closest(".download-card")).filter(Boolean))].map((card) => {
      const label = document.createElement("span");
      label.className = "release-download-count";
      label.setAttribute("aria-live", "polite");
      const actions = card.querySelector(".card-actions");
      if (actions) {
        actions.insertAdjacentElement("beforebegin", label);
      } else {
        const primaryButton = card.querySelector(".release-download");
        if (primaryButton) primaryButton.insertAdjacentElement("beforebegin", label);
      }
      return [card, label];
    }),
  );
  const numberFormatter = new Intl.NumberFormat();
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

  const t = () => LANGS[currentLang] || LANGS.en;

  const getTranslatedLabel = (button) => {
    const key = button.getAttribute("data-i18n");
    return (
      (key && t()[key]) ||
      baseButtonLabels.get(button) ||
      button.textContent.trim()
    );
  };

  const renderReleaseButton = (button, label, version = "") => {
    button.textContent = "";
    button.classList.add("download-button");

    const row = document.createElement("span");
    row.className = "download-button-row";
    row.insertAdjacentHTML("beforeend", DOWNLOAD_ICON_SVG);

    const labelSpan = document.createElement("span");
    labelSpan.className = "download-button-label";
    labelSpan.textContent = label;
    row.append(labelSpan);
    button.append(row);

    if (!version) return;
    const versionSpan = document.createElement("span");
    versionSpan.className = "download-button-version";
    versionSpan.textContent = version;
    button.append(versionSpan);
  };

  function syncButtonDecorations() {
    releaseButtons.forEach((button) => {
      renderReleaseButton(button, getTranslatedLabel(button));
    });
  }

  const appendHighlightedDownloads = (target, count, suffix) => {
    const number = document.createElement("strong");
    number.className = "release-download-number";
    number.textContent = numberFormatter.format(count);
    const word = count === 1 ? t().download : t().downloads;
    target.append(number, document.createTextNode(` ${word} ${suffix}`));
  };

  const setDownloadCountLabel = (label, count) => {
    if (!label) return;
    label.textContent = "";
    appendHighlightedDownloads(label, count, t().acrossAllVersions);
  };

  const applyMarketplaceCounts = (marketplaceDownloads = {}) => {
    marketplaceButtons.forEach((button) => {
      const baseLabel = getTranslatedLabel(button);
      const platform = button.dataset.platform;
      const card = button.closest(".download-card");
      const countLabel = card ? downloadCountLabels.get(card) : null;
      const downloadCount = marketplaceDownloads[platform];

      button.textContent = baseLabel;
      button.setAttribute(
        "aria-label",
        `${baseLabel}. Opens ${platform === "open-vsx" ? "Open VSX" : "VS Code Marketplace"}.`,
      );

      if (!countLabel || !Number.isFinite(downloadCount)) return;

      countLabel.textContent = "";
      appendHighlightedDownloads(
        countLabel,
        downloadCount,
        platform === "open-vsx"
          ? t().onOpenVsx
          : t().onVscodeMarketplace,
      );
    });
  };

  const setReleaseNote = (message, downloadCount = null) => {
    if (!note) return;
    note.textContent = "";
    note.append(document.createTextNode(`${message} `));
    if (Number.isFinite(downloadCount)) {
      appendHighlightedDownloads(note, downloadCount, t().acrossAllDesktop);
      note.append(document.createTextNode(" "));
    }
    const link = document.createElement("a");
    link.href = changelogUrl;
    link.rel = "noopener";
    link.textContent = t().seeChangelog;
    note.append(link);
  };

  const setFallback = (message) => {
    releaseButtons.forEach((button) => {
      const baseLabel = getTranslatedLabel(button);
      button.href = releaseUrl;
      renderReleaseButton(button, baseLabel);
      button.setAttribute(
        "aria-label",
        `${baseLabel}. Opens the latest GitHub Release.`,
      );
    });
    downloadCountLabels.forEach((label) => {
      label.textContent = "";
    });
    setReleaseNote(message);
  };

  const fetchJson = (url) =>
    fetch(url, { headers: apiHeaders }).then((response) => {
      if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
      return response.json();
    });

  const fetchMarketplaceDownloadStats = async () => {
    const [openVsxResponse, marketplaceResponse] = await Promise.all([
      fetch(openVsxApiUrl),
      fetch(marketplaceApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json;api-version=7.2-preview.1;excludeUrls=true",
        },
        body: JSON.stringify({
          filters: [
            {
              criteria: [
                {
                  filterType: 7,
                  value: "the-long-ride.vscode-extension-markdown-explorer",
                },
              ],
            },
          ],
          flags: 914,
        }),
      }),
    ]);

    if (!openVsxResponse.ok) {
      throw new Error(`Open VSX returned ${openVsxResponse.status}`);
    }
    if (!marketplaceResponse.ok) {
      throw new Error(`Marketplace returned ${marketplaceResponse.status}`);
    }

    const openVsx = await openVsxResponse.json();
    const marketplace = await marketplaceResponse.json();
    const statistics =
      marketplace?.results?.[0]?.extensions?.[0]?.statistics || [];

    return {
      "open-vsx": Number(openVsx.downloadCount) || 0,
      "vscode-marketplace":
        Number(
          statistics.find(
            (entry) => entry.statisticName === "downloadCount",
          )?.value,
        ) || 0,
    };
  };

  const getNextPageUrl = (linkHeader) => {
    if (!linkHeader) return "";
    const nextLink = linkHeader
      .split(",")
      .find((link) => link.includes(`rel="next"`));
    const match = nextLink && nextLink.match(/<([^>]+)>/);
    return match ? match[1] : "";
  };

  const fetchReleasePages = (url = releasesApiUrl, releases = []) =>
    fetch(url, { headers: apiHeaders }).then((response) => {
      if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
      return response.json().then((page) => {
        const combined = releases.concat(Array.isArray(page) ? page : []);
        const nextUrl = getNextPageUrl(response.headers.get("Link"));
        return nextUrl ? fetchReleasePages(nextUrl, combined) : combined;
      });
    });

  applyLang(currentLang);
  syncButtonDecorations();

  if (note || buttons.length > 0) {
    Promise.allSettled([
      Promise.all([fetchJson(latestApiUrl), fetchReleasePages()]),
      fetchMarketplaceDownloadStats(),
    ])
      .then(([releaseResult, marketplaceResult]) => {
        const marketplaceDownloads =
          marketplaceResult.status === "fulfilled" ? marketplaceResult.value : {};

        if (releaseResult.status !== "fulfilled") {
          applyMarketplaceCounts(marketplaceDownloads);
          setFallback(t().releaseApiFail);
          return;
        }

        const [release, releases] = releaseResult.value;
        const latestAssets = Array.isArray(release.assets) ? release.assets : [];
        const allReleaseAssets = releases.flatMap((item) =>
          Array.isArray(item.assets) ? item.assets : [],
        );
        const releaseVersion = release.tag_name || release.name || "";
        let selectedDesktopDownloads = 0;
        const downloadsByKey = new Map();
        const countedKeys = new Set();

        const liveVersion = releaseVersion.replace(/^v/i, "");
        if (liveVersion) {
          try {
            const ldScript = document.querySelector(
              `script[type="application/ld+json"]`,
            );
            if (ldScript) {
              const data = JSON.parse(ldScript.textContent);
              data.softwareVersion = liveVersion;
              ldScript.textContent = JSON.stringify(data, null, 2);
            }
          } catch (_) {
            // non-critical — ignore parse errors
          }
        }

        releaseButtons.forEach((button) => {
          const baseLabel = getTranslatedLabel(button);
          const platform = button.dataset.platform;
          const countKey = getCountKey(platform);
          if (!downloadsByKey.has(countKey)) {
            const platformAssets = getPlatformAssets(allReleaseAssets, platform);
            downloadsByKey.set(countKey, getDownloadCount(platformAssets));
          }
          const downloads = downloadsByKey.get(countKey) ?? 0;
          const asset = pickAsset(latestAssets, platform);
          const card = button.closest(".download-card");
          const countLabel = card ? downloadCountLabels.get(card) : null;
          renderReleaseButton(button, baseLabel, liveVersion);
          if (countLabel && !countedKeys.has(countKey)) {
            setDownloadCountLabel(countLabel, downloads);
            countedKeys.add(countKey);
            selectedDesktopDownloads += downloads;
          }

          if (!asset) {
            button.href = release.html_url || releaseUrl;
            button.setAttribute(
              "aria-label",
              `${baseLabel} ${releaseVersion || "latest"}. Opens the GitHub Release page.`,
            );
            return;
          }

          button.href = asset.browser_download_url;
          button.setAttribute(
            "aria-label",
            `Download ${asset.name} from GitHub Release ${releaseVersion || "latest"}`,
          );
          button.title = asset.name;
        });

        applyMarketplaceCounts(marketplaceDownloads);

        setReleaseNote(
          releaseVersion
            ? `${t().releaseApiNote} ${releaseVersion}.`
            : t().releaseApiNoteFallback,
          selectedDesktopDownloads,
        );
      })
      .catch(() => {
        setFallback(t().releaseApiFail);
      });
  }
  /* ── Image Lightbox Modal ──────────────────────────────────── */
  document.querySelectorAll(".feature-card img, .gallery-item img, .hero-media img").forEach((img) => {
    img.style.cursor = "zoom-in";
    img.addEventListener("click", () => {
      const modal = document.createElement("div");
      modal.className = "lightbox-modal";
      
      const modalImg = document.createElement("img");
      modalImg.src = img.src;
      modalImg.alt = img.alt || "Zoomed image";
      
      modal.appendChild(modalImg);
      document.body.appendChild(modal);
      
      // Force reflow and activate transitions
      modal.getBoundingClientRect();
      modal.classList.add("active");
      
      // Close on click anywhere
      modal.addEventListener("click", () => {
        modal.classList.remove("active");
        setTimeout(() => {
          modal.remove();
        }, 200);
      });
      
      // Close on Escape key press
      const handleEscape = (e) => {
        if (e.key === "Escape") {
          modal.classList.remove("active");
          setTimeout(() => {
            modal.remove();
          }, 200);
          document.removeEventListener("keydown", handleEscape);
        }
      };
      document.addEventListener("keydown", handleEscape);
    });
  });
  /* ── Install Guide Modal logic ────────────────────────────────── */
  const guideBtn = document.getElementById("guide-btn");
  const guideModal = document.getElementById("guide-modal");
  const modalCloseBtn = document.getElementById("modal-close-btn");

  if (guideBtn && guideModal && modalCloseBtn) {
    const openModal = () => {
      guideModal.style.display = "flex";
      document.body.style.overflow = "hidden"; // Prevent background scroll
    };

    const closeModal = () => {
      guideModal.style.display = "none";
      document.body.style.overflow = "";
    };

    guideBtn.addEventListener("click", openModal);
    modalCloseBtn.addEventListener("click", closeModal);

    // Close on clicking the backdrop overlay
    guideModal.addEventListener("click", (e) => {
      if (e.target === guideModal) {
        closeModal();
      }
    });

    // Close on Escape key press
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && guideModal.style.display === "flex") {
        closeModal();
      }
    });
  }
})();


