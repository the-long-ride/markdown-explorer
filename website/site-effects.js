(() => {
  const pageCanvas = document.getElementById("page-bg-canvas");
  if (pageCanvas) {
    const ctx = pageCanvas.getContext("2d");
    const mouse = { x: 0, y: 0, tx: 0, ty: 0, speed: 0, targetSpeed: 0, hasMoved: false };
    const resize = () => { pageCanvas.width = window.innerWidth; pageCanvas.height = window.innerHeight; };
    window.addEventListener("resize", resize);
    resize();
    mouse.tx = mouse.x = window.innerWidth / 2;
    mouse.ty = mouse.y = window.innerHeight / 2;
    const handlePointerMove = (e) => {
      const dx = e.clientX - mouse.tx, dy = e.clientY - mouse.ty;
      mouse.tx = e.clientX;
      mouse.ty = e.clientY;
      mouse.hasMoved = true;
      mouse.targetSpeed = Math.min(2.5, mouse.targetSpeed + Math.sqrt(dx * dx + dy * dy) * 0.035);
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("mousemove", handlePointerMove);
    const tick = () => {
      mouse.targetSpeed *= 0.94;
      mouse.x += (mouse.tx - mouse.x) * 0.08;
      mouse.y += (mouse.ty - mouse.y) * 0.08;
      mouse.speed += (mouse.targetSpeed - mouse.speed) * 0.08;
      ctx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
      const accentColor = getComputedStyle(document.documentElement).getPropertyValue("--accent-2").trim() || "#ff8e30";
      const hex = accentColor.startsWith("#") ? accentColor.slice(1) : "ff8e30";
      const [r, g, b] = [0, 2, 4].map((start) => parseInt(hex.substring(start, start + 2), 16) || [255, 142, 48][start / 2]);
      const isMobile = window.innerWidth <= 768;
      const gap = isMobile ? 48 : 36;
      const cols = Math.ceil(pageCanvas.width / gap) + 1, rows = Math.ceil(pageCanvas.height / gap) + 1;
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const x0 = i * gap, y0 = j * gap, dx = mouse.x - x0, dy = mouse.y - y0, dist = Math.sqrt(dx * dx + dy * dy);
        const activeRadius = isMobile ? 80 : 150 + mouse.speed * 80;
        const factor = mouse.hasMoved && dist < activeRadius ? (activeRadius - dist) / activeRadius : 0;
        const pull = factor * (isMobile ? 1.5 : 5.5) * (1 + mouse.speed * 0.8);
        const shiftX = factor ? (dx / dist) * pull : 0, shiftY = factor ? (dy / dist) * pull : 0;
        const size = 1 + factor * (isMobile ? 0.8 : 2) * (1 + mouse.speed * 0.5);
        const alpha = (isMobile ? 0.035 : 0.05) + factor * (isMobile ? 0.1 : 0.25) * (1 + mouse.speed * 0.6);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x0 + shiftX, y0 + shiftY, size, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  window.MarkdownExplorerImageViewer?.init();

  /* ── Interactive Hero Mode Switcher & Live Embed ── */
  const HERO_FEATURES = { workspace: "workspace", split: "split-editor", charts: "tables-charts" };
  const heroModeKeys = [...document.querySelectorAll("[data-hero-mode]")];
  const heroDemoIframe = document.getElementById("hero-demo-iframe");
  const heroPreviewImg = document.getElementById("hero-preview-img");
  const heroPreviewCaption = document.getElementById("hero-preview-caption-text");
  const heroPreviewCard = (heroDemoIframe || heroPreviewImg)?.closest(".hero-product-preview");
  const heroStudioPill = document.querySelector(".hero-studio-pill");
  const postDemoSelect = (iframe, feature) => {
    if (!iframe || !feature) return;
    iframe.dataset.activeFeature = feature;
    if (iframe.contentWindow) iframe.contentWindow.postMessage({ type: "mde-demo-select", feature }, "*");
    else iframe.src = `app/features/?embed=1&feature=${encodeURIComponent(feature)}`;
  };
  heroDemoIframe?.addEventListener("load", () => {
    if (heroDemoIframe.dataset.activeFeature) postDemoSelect(heroDemoIframe, heroDemoIframe.dataset.activeFeature);
  });
  if (heroModeKeys.length > 0 && (heroDemoIframe || heroPreviewImg)) {
    heroModeKeys.forEach((btn) => btn.addEventListener("click", () => {
      const mode = btn.getAttribute("data-hero-mode") || "workspace";
      const feature = btn.getAttribute("data-hero-feature") || HERO_FEATURES[mode] || "workspace";
      const nextSrc = btn.getAttribute("data-hero-src"), nextAlt = btn.getAttribute("data-hero-alt"), nextCaption = btn.getAttribute("data-hero-caption");
      heroModeKeys.forEach((key) => {
        const isActive = key === btn;
        key.classList.toggle("is-active", isActive);
        key.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
      if (heroDemoIframe) postDemoSelect(heroDemoIframe, feature);
      if (heroStudioPill) heroStudioPill.setAttribute("href", `features/?feature=${encodeURIComponent(feature)}`);
      if (heroPreviewImg && nextSrc && heroPreviewImg.src !== nextSrc) heroPreviewImg.src = nextSrc;
      if (heroPreviewImg && nextAlt) heroPreviewImg.alt = nextAlt;
      if (heroPreviewCaption && nextCaption) heroPreviewCaption.textContent = nextCaption;
      if (heroPreviewCard) { heroPreviewCard.classList.remove("is-switching"); void heroPreviewCard.offsetWidth; heroPreviewCard.classList.add("is-switching"); }
    }));
  }
  /* ── Interactive Product Spotlight Tabs (landing.html) ── */
  const spotlightTabs = [...document.querySelectorAll("[data-spotlight-tab]")];
  const spotlightPanels = [...document.querySelectorAll("[data-spotlight-panel]")];
  if (spotlightTabs.length > 0 && spotlightPanels.length > 0) {
    const activateSpotlightTab = (targetTab, focusTab = false) => {
      const targetId = targetTab.getAttribute("data-spotlight-tab");
      spotlightTabs.forEach((tab) => {
        const isActive = tab === targetTab;
        tab.classList.toggle("is-active", isActive);
        tab.setAttribute("aria-selected", isActive ? "true" : "false");
        tab.tabIndex = isActive ? 0 : -1;
      });
      spotlightPanels.forEach((panel) => {
        const matches = panel.getAttribute("data-spotlight-panel") === targetId;
        panel.hidden = !matches;
        if (matches) { const frame = panel.querySelector("[data-spotlight-iframe]"); if (frame) postDemoSelect(frame, frame.getAttribute("data-feature-slug")); }
      });
      if (focusTab) targetTab.focus();
    };
    spotlightTabs.forEach((tab, index) => {
      tab.addEventListener("click", () => activateSpotlightTab(tab, false));
      tab.addEventListener("keydown", (e) => {
        const len = spotlightTabs.length;
        const map = { ArrowRight: (index + 1) % len, ArrowLeft: (index - 1 + len) % len, Home: 0, End: len - 1 };
        if (map[e.key] === undefined) return;
        e.preventDefault();
        activateSpotlightTab(spotlightTabs[map[e.key]], true);
      });
    });
  }
  /* ── YouTube Walkthrough Placeholder Trigger ── */
  document.querySelectorAll("[data-youtube-placeholder-trigger]").forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const box = trigger.closest("[data-youtube-placeholder]");
      if (!box) return;
      const embedUrl = box.getAttribute("data-youtube-embed") || "", videoId = box.getAttribute("data-youtube-video-id") || "";
      if (embedUrl || (videoId && videoId !== "coming-soon")) {
        const stage = box.querySelector(".youtube-placeholder-stage");
        if (!stage) return;
        const iframe = Object.assign(document.createElement("iframe"), {
          className: "youtube-embed-iframe", title: "Markdown Explorer YouTube App Walkthrough", allowFullscreen: true,
          allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
          src: embedUrl || `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1`,
        });
        return stage.replaceChildren(iframe);
      }
      const nextOpen = !box.classList.contains("is-preview-open");
      box.classList.toggle("is-preview-open", nextOpen);
      const note = box.querySelector("[data-youtube-preview-note]");
      if (note) note.hidden = !nextOpen;
    });
  });

  /* ── Raw Grid Retro Scroll Reveal ── */
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const isRawGridPage = document.documentElement.getAttribute("data-theme-style") === "raw-grid";
  if (isRawGridPage && !prefersReducedMotion && typeof IntersectionObserver === "function") {
    const revealGroups = [
      document.querySelectorAll(".spotlight-stage"),
      document.querySelectorAll(".runtime-card"),
      document.querySelectorAll(".trust-item"),
      document.querySelectorAll(".download-card"),
      document.querySelectorAll(".faq details"),
      document.querySelectorAll(".legal-section"),
    ];
    const allTargets = [];
    revealGroups.forEach((group) => {
      group.forEach((el, idx) => {
        el.setAttribute("data-retro-reveal", "");
        el.style.setProperty("--retro-delay", `${Math.min(idx, 5) * 55}ms`);
        allTargets.push(el);
      });
    });
    if (allTargets.length > 0) {
      document.documentElement.classList.add("has-retro-reveal");
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          });
        },
        { rootMargin: "0px 0px -24px 0px", threshold: 0.05 },
      );
      allTargets.forEach((el) => observer.observe(el));
    }
  }

  /* ── Header GitHub Live Star Counter ── */
  const starContainers = [...document.querySelectorAll("[data-github-stars]")];
  if (starContainers.length > 0) {
    const STARS_CACHE_KEY = "mdn_github_stars_cache";
    const STARS_CACHE_TTL = 60 * 60 * 1000;
    const GITHUB_REPO_API = "https://api.github.com/repos/the-long-ride/markdown-explorer";
    const formatStars = (count) => new Intl.NumberFormat().format(count);
    const renderStars = (count) => {
      if (typeof count !== "number" || !Number.isFinite(count)) return;
      starContainers.forEach((container) => {
        const countEl = container.querySelector("[data-github-stars-count]");
        if (countEl) countEl.textContent = formatStars(count);
        container.hidden = false;
      });
    };

    let shouldFetch = true;
    try {
      const cachedRaw = localStorage.getItem(STARS_CACHE_KEY);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (typeof cached?.count === "number" && Number.isFinite(cached.count)) {
          renderStars(cached.count);
          if (typeof cached.timestamp === "number" && Date.now() - cached.timestamp < STARS_CACHE_TTL) {
            shouldFetch = false;
          }
        }
      }
    } catch (_) {
      // Ignore storage failures
    }

    if (shouldFetch && typeof fetch === "function") {
      fetch(GITHUB_REPO_API, {
        headers: { Accept: "application/vnd.github.v3+json" },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (typeof data?.stargazers_count !== "number") return;
          renderStars(data.stargazers_count);
          try {
            localStorage.setItem(
              STARS_CACHE_KEY,
              JSON.stringify({ count: data.stargazers_count, timestamp: Date.now() }),
            );
          } catch (_) {
            // Ignore storage failures
          }
        })
        .catch(() => {
          // Leave fallback cached or hidden gracefully
        });
    }
  }

  /* ── Capabilities Grab & Release Horizontal Carousel Loop ── */
  const capGrid = document.getElementById("capabilities-grid");
  const capTabs = document.querySelectorAll(".cap-tab-btn");
  const capCards = document.querySelectorAll(".cap-card");
  const capPrevBtn = document.querySelector(".cap-nav-btn.prev");
  const capNextBtn = document.querySelector(".cap-nav-btn.next");

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
        if (capGrid) {
          capGrid.scrollTo({ left: 0, behavior: "smooth" });
        }
      });
    });
  }

  if (capGrid) {
    let isDragging = false, startX = 0, scrollLeft = 0, velocity = 0, lastX = 0, animationFrameId = null;

    function checkLoop() {
      const maxScroll = capGrid.scrollWidth - capGrid.clientWidth;
      if (maxScroll <= 10) return;
      if (capGrid.scrollLeft >= maxScroll - 2) {
        capGrid.scrollLeft = 4;
        if (isDragging) {
          scrollLeft = 4;
          startX = lastX;
        }
      } else if (capGrid.scrollLeft <= 2) {
        const newPos = maxScroll - 6;
        capGrid.scrollLeft = newPos;
        if (isDragging) {
          scrollLeft = newPos;
          startX = lastX;
        }
      }
    }

    const startDrag = (pageX) => {
      isDragging = true;
      capGrid.classList.add("is-dragging");
      startX = pageX;
      scrollLeft = capGrid.scrollLeft;
      lastX = pageX;
      velocity = 0;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };

    const moveDrag = (pageX) => {
      if (!isDragging) return;
      const walk = (pageX - startX) * 1.0;
      capGrid.scrollLeft = scrollLeft - walk;
      velocity = pageX - lastX;
      lastX = pageX;
      checkLoop();
    };

    const stopDragging = () => {
      if (!isDragging) return;
      isDragging = false;
      capGrid.classList.remove("is-dragging");
      if (Math.abs(velocity) > 0.6) {
        const clampedVel = Math.max(-14, Math.min(14, velocity * 2.6));
        let currentVel = clampedVel;
        const coast = () => {
          if (Math.abs(currentVel) < 0.4 || isDragging) return;
          capGrid.scrollLeft -= currentVel;
          currentVel *= 0.88;
          checkLoop();
          animationFrameId = requestAnimationFrame(coast);
        };
        coast();
      }
    };

    capGrid.addEventListener("mousedown", (e) => {
      startDrag(e.pageX);
    });

    window.addEventListener("mouseup", stopDragging);
    capGrid.addEventListener("mouseleave", stopDragging);

    capGrid.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      e.preventDefault();
      moveDrag(e.pageX);
    });

    capGrid.addEventListener("touchstart", (e) => {
      if (!e.touches || !e.touches[0]) return;
      startDrag(e.touches[0].pageX);
    }, { passive: true });

    capGrid.addEventListener("touchmove", (e) => {
      if (!e.touches || !e.touches[0]) return;
      moveDrag(e.touches[0].pageX);
    }, { passive: true });

    capGrid.addEventListener("touchend", stopDragging, { passive: true });
    capGrid.addEventListener("touchcancel", stopDragging, { passive: true });

    capGrid.addEventListener("scroll", checkLoop, { passive: true });

    if (capPrevBtn) {
      capPrevBtn.addEventListener("click", () => {
        const maxScroll = capGrid.scrollWidth - capGrid.clientWidth;
        if (capGrid.scrollLeft <= 10) {
          capGrid.scrollLeft = maxScroll - 10;
        }
        capGrid.scrollBy({ left: -340, behavior: "smooth" });
      });
    }
    if (capNextBtn) {
      capNextBtn.addEventListener("click", () => {
        const maxScroll = capGrid.scrollWidth - capGrid.clientWidth;
        if (capGrid.scrollLeft >= maxScroll - 10) {
          capGrid.scrollLeft = 10;
        }
        capGrid.scrollBy({ left: 340, behavior: "smooth" });
      });
    }
  }
})();
