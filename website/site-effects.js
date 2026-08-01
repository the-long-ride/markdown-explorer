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
      const gap = 36, cols = Math.ceil(pageCanvas.width / gap) + 1, rows = Math.ceil(pageCanvas.height / gap) + 1;
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const x0 = i * gap, y0 = j * gap, dx = mouse.x - x0, dy = mouse.y - y0, dist = Math.sqrt(dx * dx + dy * dy);
        const activeRadius = 150 + mouse.speed * 80;
        const factor = mouse.hasMoved && dist < activeRadius ? (activeRadius - dist) / activeRadius : 0;
        const pull = factor * 5.5 * (1 + mouse.speed * 0.8);
        const shiftX = factor ? (dx / dist) * pull : 0, shiftY = factor ? (dy / dist) * pull : 0;
        const size = 1 + factor * 2 * (1 + mouse.speed * 0.5);
        const alpha = 0.05 + factor * 0.25 * (1 + mouse.speed * 0.6);
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

  const guideBtn = document.getElementById("guide-btn");
  const guideModal = document.getElementById("guide-modal");
  const modalCloseBtn = document.getElementById("modal-close-btn");
  if (guideBtn && guideModal && modalCloseBtn) {
    const openModal = () => { guideModal.style.display = "flex"; document.body.style.overflow = "hidden"; };
    const closeModal = () => { guideModal.style.display = "none"; document.body.style.overflow = ""; };
    guideBtn.addEventListener("click", openModal);
    modalCloseBtn.addEventListener("click", closeModal);
    guideModal.addEventListener("click", (e) => { if (e.target === guideModal) closeModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && guideModal.style.display === "flex") closeModal(); });
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
      const walk = (pageX - startX) * 1.35;
      capGrid.scrollLeft = scrollLeft - walk;
      velocity = pageX - lastX;
      lastX = pageX;
      checkLoop();
    };

    const stopDragging = () => {
      if (!isDragging) return;
      isDragging = false;
      capGrid.classList.remove("is-dragging");
      if (Math.abs(velocity) > 0.8) {
        let currentVel = velocity * 8;
        const coast = () => {
          if (Math.abs(currentVel) < 0.4 || isDragging) return;
          capGrid.scrollLeft -= currentVel;
          currentVel *= 0.92;
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
