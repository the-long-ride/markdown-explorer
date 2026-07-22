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

  const formatText = (text) => {
    if (!text || typeof text !== "string") return text;
    if (text.includes("`")) {
      return text.replace(/`([^`]+)`/g, '<code>$1</code>');
    }
    return text;
  };

  const applyLang = (lang) => {
    currentLang = lang;
    localStorage.setItem(LS_LANG, lang);
    const t = LANGS[lang];
    if (!t) return;
    langLabel.textContent = t.label;
    html.setAttribute("lang", lang);
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (t[key] !== undefined) {
        const val = t[key];
        if (val.includes("`") || val.includes("<br>")) {
          el.innerHTML = formatText(val);
        } else {
          el.textContent = val;
        }
      }
    });
    // Mark active in menu
    document.querySelectorAll(".lang-menu button[data-lang]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.lang === lang);
    });
  };

  applyLang(currentLang);

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

  /* ── Capabilities category tabs filtering ──────────────────────── */
  const capTabs = document.querySelectorAll(".cap-tab-btn");
  const capCards = document.querySelectorAll(".cap-card");
  if (capTabs.length > 0 && capCards.length > 0) {
    capTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const category = tab.getAttribute("data-category");
        capTabs.forEach((t) => {
          t.classList.toggle("active", t === tab);
          t.setAttribute("aria-selected", t === tab ? "true" : "false");
        });
        capCards.forEach((card) => {
          const cardCategory = card.getAttribute("data-category");
          const matches = category === "all" || cardCategory === category;
          card.classList.toggle("hidden", !matches);
        });
      });
    });
  }

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
  const downloadHelpers = window.MdeSiteDownloadHelpers || {
    DOWNLOAD_ICON_SVG: '',
    getCountKey: (platform) => platform,
    getDownloadCount: () => 0,
    getPlatformAssets: () => [],
    pickAsset: () => null,
  };
  const {
    DOWNLOAD_ICON_SVG,
    getCountKey,
    getDownloadCount,
    getPlatformAssets,
    pickAsset,
  } = downloadHelpers;
  const t = () => LANGS[currentLang] || LANGS.en;

  const {
    applyMarketplaceCounts,
    getTranslatedLabel,
    renderReleaseButton,
    setDownloadCountLabel,
    setFallback,
    setReleaseNote,
    syncButtonDecorations,
  } = (window.MdeSiteDownloadRendering || (() => ({
    applyMarketplaceCounts: () => {},
    getTranslatedLabel: (button) => button.textContent.trim(),
    renderReleaseButton: () => {},
    setDownloadCountLabel: () => {},
    setFallback: () => {},
    setReleaseNote: () => {},
    syncButtonDecorations: () => {},
  })))({
    DOWNLOAD_ICON_SVG,
    releaseButtons,
    marketplaceButtons,
    downloadCountLabels,
    baseButtonLabels,
    numberFormatter,
    note,
    releaseUrl,
    changelogUrl,
    t: () => LANGS[currentLang] || LANGS.en,
  });

  const { fetchJson, fetchMarketplaceDownloadStats, fetchReleasePages } =
    (window.MdeSiteReleaseApi || (() => ({
      fetchJson: async () => ({}),
      fetchMarketplaceDownloadStats: async () => ({}),
      fetchReleasePages: async () => [],
    })))({
      apiHeaders,
      releasesApiUrl,
      openVsxApiUrl,
      marketplaceApiUrl,
    });

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
})();


