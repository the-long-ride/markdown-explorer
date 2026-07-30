(() => {
  const MIN_SCALE = 0.5;
  const MAX_SCALE = 4;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const normalizeText = (value) => value?.replace(/\s+/g, " ").trim() || "";

  function getImageFeature(image) {
    const card = image.closest(".feature-card");
    const figure = image.closest("figure");
    const heroPreview = image.closest(".hero-product-preview");
    return {
      title: normalizeText(
        card?.querySelector(".card-kicker")?.textContent
        || card?.querySelector("h3")?.textContent
        || heroPreview?.querySelector(".hero-preview-kicker")?.textContent
        || (figure ? "Gallery" : "Image"),
      ),
      description: normalizeText(
        card?.querySelector("p:not(.card-kicker)")?.textContent
        || figure?.querySelector("figcaption")?.textContent
        || heroPreview?.querySelector(".hero-preview-caption")?.textContent
        || image.alt,
      ),
    };
  }

  function isViewableImage(image) {
    return !image.closest(".brand, .site-logo, .icon, [data-no-image-viewer]")
      && !image.classList.contains("icon")
      && image.getAttribute("role") !== "presentation";
  }

  function createButton(doc, className, label, text) {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = className;
    button.setAttribute("aria-label", label);
    button.textContent = text;
    return button;
  }

  function createModal(doc) {
    const modal = doc.createElement("div");
    modal.className = "lightbox-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "Image viewer");
    modal.hidden = true;

    const panel = doc.createElement("div");
    panel.className = "lightbox-panel";
    const stage = doc.createElement("div");
    stage.className = "lightbox-stage";
    const image = doc.createElement("img");
    image.className = "lightbox-image";
    image.draggable = false;

    const controls = doc.createElement("div");
    controls.className = "lightbox-controls";
    const zoomOut = createButton(doc, "lightbox-control", "Zoom out", "−");
    const reset = createButton(doc, "lightbox-control lightbox-reset", "Reset zoom", "100%");
    const zoomIn = createButton(doc, "lightbox-control", "Zoom in", "+");
    controls.append(zoomOut, reset, zoomIn);
    stage.append(image, controls);

    const description = doc.createElement("aside");
    description.className = "lightbox-description";
    const title = doc.createElement("strong");
    title.className = "lightbox-description-title";
    const text = doc.createElement("p");
    text.className = "lightbox-description-text";
    description.append(title, text);
    panel.append(stage, description);

    const close = createButton(doc, "lightbox-close", "Close image viewer", "×");
    modal.append(panel, close);
    doc.body.append(modal);
    return { modal, panel, stage, image, zoomOut, reset, zoomIn, title, text, close };
  }

  function init({ root = document } = {}) {
    const doc = root.nodeType === 9 ? root : root.ownerDocument;
    const elements = createModal(doc);
    const pointers = new Map();
    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let dragOrigin = null;
    let pinchDistance = null;
    let bodyOverflow = "";
    let activeImage = null;

    const renderTransform = () => {
      elements.image.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
      elements.reset.textContent = `${Math.round(scale * 100)}%`;
      elements.stage.classList.toggle("is-pannable", scale > 1);
    };
    const reset = () => {
      scale = 1;
      translateX = 0;
      translateY = 0;
      renderTransform();
    };
    const zoomBy = (delta) => {
      scale = clamp(Number((scale + delta).toFixed(2)), MIN_SCALE, MAX_SCALE);
      if (scale <= 1) {
        translateX = 0;
        translateY = 0;
      }
      renderTransform();
      return scale;
    };
    const close = () => {
      if (elements.modal.hidden) return;
      elements.modal.classList.remove("active");
      elements.modal.hidden = true;
      doc.body.style.overflow = bodyOverflow;
      pointers.clear();
      activeImage?.focus?.();
      activeImage = null;
      reset();
    };
    const open = (sourceImage) => {
      activeImage = sourceImage;
      const feature = getImageFeature(sourceImage);
      elements.image.src = sourceImage.currentSrc || sourceImage.src;
      elements.image.alt = sourceImage.alt || "Zoomed image";
      elements.title.textContent = feature.title;
      elements.text.textContent = feature.description;
      bodyOverflow = doc.body.style.overflow;
      doc.body.style.overflow = "hidden";
      elements.modal.hidden = false;
      reset();
      requestAnimationFrame(() => elements.modal.classList.add("active"));
      elements.close.focus();
    };

    const onKeydown = (event) => {
      if (elements.modal.hidden) return;
      if (event.key === "Escape") close();
      if (event.key === "+" || event.key === "=") zoomBy(0.25);
      if (event.key === "-") zoomBy(-0.25);
      if (event.key === "0") reset();
    };
    const onWheel = (event) => {
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? 0.25 : -0.25);
    };
    const distance = () => {
      const values = [...pointers.values()];
      if (values.length < 2) return null;
      return Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
    };
    const onPointerDown = (event) => {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      elements.stage.setPointerCapture?.(event.pointerId);
      if (pointers.size === 1 && scale > 1) {
        dragOrigin = { x: event.clientX, y: event.clientY, translateX, translateY };
      }
      pinchDistance = distance();
    };
    const onPointerMove = (event) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const nextDistance = distance();
      if (nextDistance && pinchDistance) {
        zoomBy((nextDistance - pinchDistance) / 180);
        pinchDistance = nextDistance;
        return;
      }
      if (dragOrigin && scale > 1) {
        translateX = dragOrigin.translateX + event.clientX - dragOrigin.x;
        translateY = dragOrigin.translateY + event.clientY - dragOrigin.y;
        renderTransform();
      }
    };
    const onPointerUp = (event) => {
      pointers.delete(event.pointerId);
      dragOrigin = null;
      pinchDistance = distance();
    };

    elements.zoomIn.addEventListener("click", () => zoomBy(0.25));
    elements.zoomOut.addEventListener("click", () => zoomBy(-0.25));
    elements.reset.addEventListener("click", reset);
    elements.close.addEventListener("click", close);
    elements.modal.addEventListener("click", (event) => {
      if (event.target === elements.modal) close();
    });
    elements.stage.addEventListener("wheel", onWheel, { passive: false });
    elements.stage.addEventListener("pointerdown", onPointerDown);
    elements.stage.addEventListener("pointermove", onPointerMove);
    elements.stage.addEventListener("pointerup", onPointerUp);
    elements.stage.addEventListener("pointercancel", onPointerUp);
    doc.addEventListener("keydown", onKeydown);

    const images = [...root.querySelectorAll("img")].filter(isViewableImage);
    const imageListeners = images.map((image, index) => {
      image.dataset.imageName = `Image #${index + 1}`;
      image.dataset.imagePath = image.currentSrc || image.getAttribute("src") || "Unknown image path";
      image.style.cursor = "zoom-in";
      image.tabIndex = image.tabIndex >= 0 ? image.tabIndex : 0;
      const activate = (event) => {
        if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
        event.preventDefault();
        open(image);
      };
      image.addEventListener("click", activate);
      image.addEventListener("keydown", activate);
      return { image, activate };
    });

    const controller = {
      open,
      close,
      zoomBy,
      reset,
      get scale() { return scale; },
      destroy() {
        close();
        doc.removeEventListener("keydown", onKeydown);
        imageListeners.forEach(({ image, activate }) => {
          image.removeEventListener("click", activate);
          image.removeEventListener("keydown", activate);
        });
        elements.modal.remove();
      },
    };
    return controller;
  }

  const api = { init, clamp, MIN_SCALE, MAX_SCALE };
  window.MarkdownExplorerImageViewer = api;
})();
