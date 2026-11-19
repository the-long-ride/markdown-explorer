import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

const root = new URL("../../", import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, root), "utf8");
}

describe("website landing and tauri download contracts", () => {
  it("ensures website/landing.html exists and contains key marketing sections", async () => {
    const landingPath = new URL("website/landing.html", root);
    assert.ok(existsSync(landingPath), "website/landing.html must exist");

    const html = await readProjectFile("website/landing.html");
    assert.ok(html.includes('id="features"'), "landing.html must contain #features");
    assert.ok(html.includes('id="download"'), "landing.html must contain #download");
    assert.ok(html.includes('id="gallery"'), "landing.html must contain #gallery");
    assert.ok(html.includes('id="faq"'), "landing.html must contain #faq");
  });

  it("prioritizes and highlights Tauri builds in download section of landing.html", async () => {
    for (const filePath of ["website/landing.html"]) {
      const html = await readProjectFile(filePath);

      // Windows
      const winLightIdx = html.indexOf('id="dl-win-light-btn"');
      const winLightPortableIdx = html.indexOf('id="dl-win-light-portable-btn"');
      const winBtnIdx = html.indexOf('id="dl-win-btn"');
      const winPortableIdx = html.indexOf('id="dl-win-portable-btn"');

      assert.ok(winLightIdx >= 0, `${filePath} must contain #dl-win-light-btn`);
      assert.ok(winLightPortableIdx >= 0, `${filePath} must contain #dl-win-light-portable-btn`);
      assert.ok(winBtnIdx >= 0, `${filePath} must contain #dl-win-btn`);
      assert.ok(winPortableIdx >= 0, `${filePath} must contain #dl-win-portable-btn`);
      assert.ok(
        winLightIdx < winBtnIdx &&
          winLightIdx < winPortableIdx &&
          winLightPortableIdx < winBtnIdx &&
          winLightPortableIdx < winPortableIdx,
        `${filePath}: Rust Tauri installer and portable buttons must appear before Electron buttons`,
      );

      // Linux
      const linuxLightIdx = html.indexOf('id="dl-linux-light-btn"');
      const linuxLightDebIdx = html.indexOf('id="dl-linux-light-deb-btn"');
      const linuxBtnIdx = html.indexOf('id="dl-linux-btn"');
      const linuxDebIdx = html.indexOf('id="dl-linux-deb-btn"');

      assert.ok(linuxLightIdx >= 0, `${filePath} must contain #dl-linux-light-btn`);
      assert.ok(linuxLightDebIdx >= 0, `${filePath} must contain #dl-linux-light-deb-btn`);
      assert.ok(linuxBtnIdx >= 0, `${filePath} must contain #dl-linux-btn`);
      assert.ok(linuxDebIdx >= 0, `${filePath} must contain #dl-linux-deb-btn`);
      assert.ok(
        linuxLightIdx < linuxBtnIdx && linuxLightDebIdx < linuxBtnIdx,
        `${filePath}: Linux Tauri builds must appear before standard AppImage and deb buttons`,
      );

      // macOS
      const macLightIdx = html.indexOf('id="dl-mac-light-btn"');
      const macArmIdx = html.indexOf('id="dl-mac-arm-btn"');
      const macIntelIdx = html.indexOf('id="dl-mac-intel-btn"');

      assert.ok(macLightIdx >= 0, `${filePath} must contain #dl-mac-light-btn`);
      assert.ok(macArmIdx >= 0, `${filePath} must contain #dl-mac-arm-btn`);
      assert.ok(macIntelIdx >= 0, `${filePath} must contain #dl-mac-intel-btn`);
      assert.ok(
        macLightIdx < macArmIdx && macLightIdx < macIntelIdx,
        `${filePath}: macOS Tauri build must appear before Apple Silicon and Intel buttons`,
      );

      // Tauri buttons carry btn-primary styling
      const buttonSnippets = [
        html.slice(winLightIdx, html.indexOf(">", winLightIdx)),
        html.slice(winLightPortableIdx, html.indexOf(">", winLightPortableIdx)),
        html.slice(linuxLightIdx, html.indexOf(">", linuxLightIdx)),
        html.slice(linuxLightDebIdx, html.indexOf(">", linuxLightDebIdx)),
        html.slice(macLightIdx, html.indexOf(">", macLightIdx)),
      ];

      for (const snippet of buttonSnippets) {
        assert.ok(
          snippet.includes("btn-primary") || snippet.includes("primary"),
          `Tauri button snippet must include primary styling: ${snippet}`,
        );
      }
    }
  });

  it("ensures website/index.html redirects default root visits to app/?mode=web without ?landing=1", async () => {
    const html = await readProjectFile("website/index.html");

    assert.ok(
      html.includes("app/?mode=web") || html.includes("./app/?mode=web"),
      "index.html must reference target app/?mode=web",
    );
    assert.ok(
      html.includes("location.replace") || html.includes("location.href"),
      "index.html must include redirection script for root visits",
    );
    assert.ok(
      !html.includes("landing=1"),
      "index.html must not serve or check deprecated ?landing=1 page parameter",
    );
    assert.ok(
      html.includes("landing.html"),
      "index.html must route section anchors cleanly to landing.html",
    );
  });

  it("ensures website/privacy.html and website/terms.html link to landing.html and web app mode=web", async () => {
    for (const filePath of ["website/privacy.html", "website/terms.html"]) {
      const html = await readProjectFile(filePath);
      assert.ok(
        html.includes("landing.html") || html.includes("index.html"),
        `${filePath} must have navigation links back to landing or home`,
      );
      assert.ok(
        html.includes("app/?mode=web") || html.includes("./app/?mode=web") || html.includes("landing.html"),
        `${filePath} must allow accessing the Web App or landing page`,
      );
    }
  });

  it("uses Raw Grid default theme tokens and mounts live interactive component demo iframes + YouTube placeholder on landing.html", async () => {
    const landing = await readProjectFile("website/landing.html");
    const foundationCss = await readProjectFile("website/styles/site-foundation.css");
    const rawGridCss = await readProjectFile("website/styles/landing-raw-grid.css");
    const heroWindowCss = await readProjectFile("website/styles/landing-hero-window.css");
    const effectsJs = await readProjectFile("website/site-effects.js");

    assert.ok(landing.includes('data-theme-style="raw-grid"'), "landing.html should activate Raw Grid theme style");
    assert.ok(foundationCss.includes("--bg: #101010;"), "dark theme should use Raw Grid #101010 background");
    assert.ok(foundationCss.includes("--bg: #f2efe9;"), "light theme should use Raw Grid #f2efe9 background");
    assert.ok(foundationCss.includes("--accent: #ff6a22;"), "dark theme should use Raw Grid #ff6a22 accent");
    assert.ok(foundationCss.includes("--accent: #d84b00;"), "light theme should use Raw Grid #d84b00 accent");
    assert.ok(foundationCss.includes("::selection"), "landing styles should match app ::selection styling");
    assert.ok(rawGridCss.includes("background-size: 48px 48px;"), "Raw Grid layout should render 48px structural grid lines");
    assert.ok(rawGridCss.includes("border-radius: 0 !important;"), "Raw Grid layout should use sharp angular 0px corners");
    assert.ok(rawGridCss.includes("retroGridDrift"), "Raw Grid layout should include retro animation keyframes");
    assert.ok(rawGridCss.includes("prefers-reduced-motion: reduce"), "Raw Grid retro animations must respect prefers-reduced-motion");
    assert.ok(rawGridCss.includes(".legal-hero") && rawGridCss.includes(".legal-section"), "Privacy and Terms content must sit inside Raw Grid retro panels");
    assert.ok(heroWindowCss.includes('[data-theme-style="raw-grid"] .hero-text-side'), "Hero copy side must sit inside a solid Raw Grid retro panel");

    const mainSection = landing.match(/<main[\s\S]*?<\/main>/)?.[0] || "";
    const mainImages = mainSection.match(/<img\b/g) || [];
    assert.equal(mainImages.length, 0, "landing <main> should replace static demo <img> tags with live component demo iframes");
    assert.ok(mainSection.includes('id="hero-demo-iframe"'), "landing <main> must mount #hero-demo-iframe");
    const spotlightIframes = mainSection.match(/data-spotlight-iframe="/g) || [];
    assert.equal(spotlightIframes.length, 4, "landing <main> should mount 4 live [data-spotlight-iframe] demos");
    assert.ok(mainSection.includes('id="video-demo"'), "landing <main> must include #video-demo section");
    assert.ok(mainSection.includes("data-youtube-placeholder"), "landing <main> must include [data-youtube-placeholder]");
    assert.ok(landing.includes('href="features/"'), "landing.html must link to features/");

    const spotlightTabs = landing.match(/data-spotlight-tab="/g) || [];
    const spotlightPanels = landing.match(/data-spotlight-panel="/g) || [];
    assert.equal(spotlightTabs.length, 4, "landing.html should have 4 spotlight tabs");
    assert.equal(spotlightPanels.length, 4, "landing.html should have 4 spotlight panels");
    assert.ok(landing.includes('id="runtimes"'), "landing.html should include the Where It Runs section");
    assert.ok(effectsJs.includes("[data-spotlight-tab]"), "site-effects.js must wire interactive spotlight tabs");
    assert.ok(effectsJs.includes("data-retro-reveal"), "site-effects.js must wire retro scroll reveal for Raw Grid");
    assert.ok(effectsJs.includes("stargazers_count"), "site-effects.js must populate live GitHub stars");

    assert.ok(!landing.includes('id="demo-btn"'), "landing.html header should not include Demo dropdown");
    assert.ok(!landing.includes('data-i18n="navGallery"'), "landing.html header should not include Gallery nav link");
    assert.ok(landing.includes('class="nav-github-link"'), "landing.html header should include GitHub nav link");
    assert.ok(landing.includes('data-github-stars'), "landing.html header GitHub link should show star counter");

    const helpersJs = await readProjectFile("website/site-download-helpers.js");
    assert.ok(
      helpersJs.includes('"tauri-windows-portable"'),
      "site-download-helpers.js must define tauri-windows-portable asset matching",
    );
  });
});
