window.MdeSiteDownloadRendering = ({
  DOWNLOAD_ICON_SVG,
  releaseButtons,
  marketplaceButtons,
  downloadCountLabels,
  baseButtonLabels,
  numberFormatter,
  note,
  releaseUrl,
  changelogUrl,
  t,
}) => {
  let activeVersion = "";

  const getTranslatedLabel = (button) => {
    const key = button.getAttribute("data-i18n");
    return (
      (key && t()[key]) ||
      baseButtonLabels.get(button) ||
      button.textContent.trim()
    );
  };

  const renderReleaseButton = (button, label) => {
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
  };

  function syncButtonDecorations(version = "") {
    if (version) activeVersion = version.replace(/^v/i, "");
    releaseButtons.forEach((button) => {
      renderReleaseButton(button, getTranslatedLabel(button));
    });
    if (activeVersion) {
      updateVersionTexts(activeVersion);
    }
  }

  const updateVersionTexts = (version = "") => {
    if (!version) return;
    const cleanVersion = version.replace(/^v/i, "");
    const taggedVersion = version.startsWith("v") ? version : `v${cleanVersion}`;
    activeVersion = cleanVersion;

    try {
      const ldScript = document.querySelector(
        `script[type="application/ld+json"]`,
      );
      if (ldScript) {
        const data = JSON.parse(ldScript.textContent);
        data.softwareVersion = cleanVersion;
        ldScript.textContent = JSON.stringify(data, null, 2);
      }
    } catch (_) {
      // non-critical
    }

    document.querySelectorAll("[data-version-text], .version-text").forEach((el) => {
      const fmt = el.dataset.versionFormat;
      if (fmt === "raw" || fmt === "clean") {
        el.textContent = cleanVersion;
      } else {
        el.textContent = taggedVersion;
      }
    });
  };

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

  const setFallback = (message, fallbackVersion = "") => {
    if (fallbackVersion) activeVersion = fallbackVersion.replace(/^v/i, "");
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
    if (activeVersion) {
      updateVersionTexts(activeVersion);
    }
  };

  return {
    getTranslatedLabel,
    renderReleaseButton,
    syncButtonDecorations,
    updateVersionTexts,
    appendHighlightedDownloads,
    setDownloadCountLabel,
    applyMarketplaceCounts,
    setReleaseNote,
    setFallback,
  };
};


