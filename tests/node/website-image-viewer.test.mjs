import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

const root = new URL("../../", import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, root), "utf8");
}

describe("website image descriptions", () => {
  it("provides metadata for every page image", async () => {
    const html = await readProjectFile("website/index.html");
    const imageCount = [...html.matchAll(/<img\b/gi)].length;
    const script = await readProjectFile("website/site-effects.js");

    assert.ok(imageCount > 0);
    assert.ok(script.includes("document.querySelectorAll(\"img\")"));
    assert.ok(script.includes("img.dataset.imageName = `Image #${index + 1}`"));
    assert.ok(script.includes("img.dataset.imagePath"));
  });

  it("renders the selected image description in the lightbox", async () => {
    const script = await readProjectFile("website/site-effects.js");
    const styles = await readProjectFile("website/styles/base.part3.css");

    assert.ok(script.includes('description.className = "lightbox-description"'));
    assert.ok(script.includes('card?.querySelector(".card-kicker")'));
    assert.ok(script.includes("descriptionText.className = \"lightbox-description-text\""));
    assert.ok(script.includes("descriptionText.textContent = feature.description"));
    assert.ok(!script.includes("path.textContent = img.dataset.imagePath"));
    assert.ok(script.includes("img.dataset.imageName"));
    assert.ok(script.includes("img.dataset.imagePath"));
    assert.ok(styles.includes(".lightbox-description"));
    assert.ok(styles.includes("grid-template-columns"));
  });

  it("uses a denser responsive feature grid without cropping images", async () => {
    const styles = await readProjectFile("website/styles/base.part2.css");
    const responsive = await readProjectFile("website/styles/responsive.part1.css");

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
    for (const source of [html, english]) {
      assert.ok(source.includes("Workspace history"));
    }
    assert.ok(english.includes('galleryCaption3Title: "Isolated HTML Sandboxes"'));

    assert.equal(
      (html.match(/support-focus-and-full-screen-mode-turn-your-document-to-presentation\.png/g) || []).length,
      1,
    );
  });
});
