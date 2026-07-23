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

  document.querySelectorAll(".feature-card img, .gallery-item img, .hero-media img").forEach((img) => {
    img.style.cursor = "zoom-in";
    img.addEventListener("click", () => {
      const modal = document.createElement("div"), modalImg = document.createElement("img");
      modal.className = "lightbox-modal";
      modalImg.src = img.src;
      modalImg.alt = img.alt || "Zoomed image";
      modal.appendChild(modalImg);
      document.body.appendChild(modal);
      modal.getBoundingClientRect();
      modal.classList.add("active");
      const close = () => { modal.classList.remove("active"); setTimeout(() => modal.remove(), 200); };
      modal.addEventListener("click", close);
      const handleEscape = (e) => { if (e.key === "Escape") { close(); document.removeEventListener("keydown", handleEscape); } };
      document.addEventListener("keydown", handleEscape);
    });
  });

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
})();
