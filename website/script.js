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

  // Apply initial language
  applyLang(currentLang);

  /* ── GitHub release download logic ───────────────────────────── */
  const releaseUrl =
    "https://github.com/the-long-ride/markdown-explorer/releases/latest";
  const latestApiUrl =
    "https://api.github.com/repos/the-long-ride/markdown-explorer/releases/latest";
  const releasesApiUrl =
    "https://api.github.com/repos/the-long-ride/markdown-explorer/releases?per_page=100";
  const changelogUrl =
    "https://github.com/the-long-ride/markdown-explorer/blob/main/CHANGELOG.md";
  const apiHeaders = { Accept: "application/vnd.github+json" };
  const note = document.querySelector("#release-note");
  const buttons = [...document.querySelectorAll(".release-download")];
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

  const assetMatchers = {
    "windows-nsis": (name) => name.includes("setup") && name.endsWith(".exe"),
    "windows-portable": (name) => !name.includes("setup") && name.endsWith(".exe"),
    "macos-arm64": (name) => name.endsWith(".dmg") && name.includes("arm64"),
    "macos-x64": (name) => name.endsWith(".dmg") && name.includes("x64"),
    "linux-appimage": (name) => name.endsWith(".appimage"),
    "linux-deb": (name) => name.endsWith(".deb"),
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
  };

  const getCountKey = (platform) => platformGroup[platform] || platform;

  const preferredScore = {
    "windows-nsis": () => 10,
    "windows-portable": () => 10,
    "macos-arm64": () => 10,
    "macos-x64": () => 10,
    "linux-appimage": () => 10,
    "linux-deb": () => 10,
    chromium: (name) => (name.includes("chromium") ? 10 : 5),
  };

  const fallbackMatchers = {
    "macos-arm64": (name) => name.endsWith(".dmg"),
    "macos-x64": (name) => name.endsWith(".dmg"),
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
    buttons.forEach((button) => {
      const baseLabel =
        baseButtonLabels.get(button) || button.textContent.trim();
      button.href = releaseUrl;
      button.textContent = baseLabel;
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

  if (note || buttons.length > 0) {
    Promise.all([fetchJson(latestApiUrl), fetchReleasePages()])
      .then(([release, releases]) => {
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

        buttons.forEach((button) => {
          const baseLabel =
            baseButtonLabels.get(button) || button.textContent.trim();
          const versionedLabel = releaseVersion
            ? `${baseLabel} ${releaseVersion}`
            : baseLabel;
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
          button.textContent = versionedLabel;
          if (countLabel && !countedKeys.has(countKey)) {
            setDownloadCountLabel(countLabel, downloads);
            countedKeys.add(countKey);
            selectedDesktopDownloads += downloads;
          }

          if (!asset) {
            button.href = release.html_url || releaseUrl;
            button.setAttribute(
              "aria-label",
              `${versionedLabel}. Opens the GitHub Release page.`,
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


