import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import vm from "node:vm";

const root = new URL("../../", import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, root), "utf8");
}

describe("website image viewer", () => {
  it("loads the controller before site effects and initializes it once", async () => {
    const html = await readProjectFile("website/index.html");
    const effects = await readProjectFile("website/site-effects.js");
    const viewerIndex = html.indexOf('src="site-image-viewer.js"');
    const effectsIndex = html.indexOf('src="site-effects.js"');

    assert.ok(viewerIndex >= 0);
    assert.ok(viewerIndex < effectsIndex);
    assert.equal((effects.match(/MarkdownExplorerImageViewer\?\.init\(\)/g) || []).length, 1);
    assert.ok(!effects.includes('document.createElement("div")'));
  });

  it("keeps image metadata and places description after the stage", async () => {
    const script = await readProjectFile("website/site-image-viewer.js");
    assert.ok(script.includes('root.querySelectorAll("img")'));
    assert.ok(script.includes('image.dataset.imageName = `Image #${index + 1}`'));
    assert.ok(script.includes("image.dataset.imagePath"));
    assert.ok(script.includes("panel.append(stage, description)"));
    assert.ok(script.includes('description.className = "lightbox-description"'));
  });

  it("clamps zoom between 50 and 400 percent", async () => {
    const script = await readProjectFile("website/site-image-viewer.js");
    const sandbox = { window: {} };
    vm.runInNewContext(script, sandbox);
    const api = sandbox.window.MarkdownExplorerImageViewer;
    assert.equal(api.MIN_SCALE, 0.5);
    assert.equal(api.MAX_SCALE, 4);
    assert.equal(api.clamp(0.1, api.MIN_SCALE, api.MAX_SCALE), 0.5);
    assert.equal(api.clamp(9, api.MIN_SCALE, api.MAX_SCALE), 4);
  });

  it("supports backdrop-only close, keyboard controls, wheel zoom, pinch, and pan", async () => {
    const script = await readProjectFile("website/site-image-viewer.js");
    for (const contract of [
      'event.target === elements.modal',
      'event.key === "Escape"',
      'elements.stage.addEventListener("wheel"',
      'elements.stage.addEventListener("pointerdown"',
      'pointers.size === 1 && scale > 1',
      'const nextDistance = distance()',
      'doc.body.style.overflow = bodyOverflow',
      'createButton(doc, "lightbox-close", "Close image viewer"',
    ]) assert.ok(script.includes(contract), `missing ${contract}`);
  });

  it("stacks the description below the image on tablet and mobile", async () => {
    const styles = await readProjectFile("website/styles/image-viewer.css");
    assert.ok(styles.includes("@media (max-width: 900px)"));
    assert.ok(styles.includes("grid-template-columns: minmax(0, 1fr);"));
    assert.ok(styles.includes(".lightbox-stage { order: 1;"));
    assert.ok(styles.includes(".lightbox-description { order: 2;"));
    assert.ok(styles.includes("width: min(100%, 44rem)"));
    assert.ok(styles.includes("overflow-wrap: break-word"));
  });

  it("uses a denser responsive feature grid without cropping images", async () => {
    const styles = await readProjectFile("website/styles/homepage-sections.css");
    const responsive = await readProjectFile("website/styles/responsive-tablet.css");
    assert.ok(styles.includes("grid-template-columns: repeat(3, minmax(0, 1fr));"));
    assert.ok(styles.includes(".feature-card img"));
    assert.ok(styles.includes("height: auto;"));
    assert.ok(styles.includes("object-fit: cover;"));
    assert.ok(responsive.includes(".feature-grid"));
    assert.ok(responsive.includes("grid-template-columns: repeat(2, minmax(0, 1fr));"));
  });

  it("keeps feature copy short and removes the duplicated fullscreen gallery image", async () => {
    const html = await readProjectFile("website/index.html");
    const english = await readProjectFile("website/i18n/en.js");
    assert.ok(html.includes("Scope Focus"));
    assert.ok(html.includes("HTML Sandboxes & Video Embeds"));
    assert.ok(html.includes("galleryCaption3"));
    for (const source of [html, english]) assert.ok(source.includes("Workspace history"));
    assert.ok(english.includes('galleryCaption3Title: "Isolated HTML Sandboxes"'));
    assert.equal((html.match(/support-focus-and-full-screen-mode-turn-your-document-to-presentation\.png/g) || []).length, 1);
  });
});
