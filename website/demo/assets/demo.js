/* Markdown Explorer — Demo shared renderer.
 *
 * Loads markdown libraries from CDN (marked, marked-alert, DOMPurify,
 * highlight.js, mermaid, KaTeX) and exposes a single helper:
 *
 *   await DemoRenderer.init();
 *   DemoRenderer.render(containerEl, markdownText);
 *
 * Rendering mirrors the core VS Code reader experience: GFM, task lists,
 * GitHub-style alert callouts, syntax-highlighted code, Mermaid diagrams,
 * and LaTeX math (KaTeX). Content is sanitized with DOMPurify.
 */
(function (global) {
  "use strict";

  const CDN = "https://cdn.jsdelivr.net/npm";
  const loaded = {};

  function loadScript(src) {
    if (loaded[src]) return loaded[src];
    loaded[src] = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.crossOrigin = "anonymous";
      s.onload = resolve;
      s.onerror = () => reject(new Error("Failed to load " + src));
      document.head.appendChild(s);
    });
    return loaded[src];
  }

  function loadStyle(href) {
    if (loaded[href]) return loaded[href];
    loaded[href] = new Promise((resolve, reject) => {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = href;
      l.crossOrigin = "anonymous";
      l.onload = resolve;
      l.onerror = () => reject(new Error("Failed to load " + href));
      document.head.appendChild(l);
    });
    return loaded[href];
  }

  let ready = null;
  function init() {
    if (ready) return ready;
    ready = (async () => {
      await Promise.all([
        loadScript(`${CDN}/marked@12.0.2/marked.min.js`),
        loadScript(`${CDN}/marked-alert@2.0.1/index.umd.js`),
        loadScript(`${CDN}/dompurify@3.1.6/dist/purify.min.js`),
        loadScript(`${CDN}/highlight.js@11.10.0/lib/index.min.js`),
        loadStyle(`${CDN}/highlight.js@11.10.0/styles/github-dark.min.css`),
        loadScript(`${CDN}/katex@0.16.11/dist/katex.min.js`),
        loadStyle(`${CDN}/katex@0.16.11/dist/katex.min.css`),
        loadScript(`${CDN}/katex@0.16.11/dist/contrib/auto-render.min.js`),
      ]);

      // Mermaid is heavy — load but configure lazily.
      await loadScript(`${CDN}/mermaid@11.4.1/dist/mermaid.min.js`);
      const mermaid = global.mermaid;
      if (mermaid) {
        mermaid.initialize({
          startOnLoad: false,
          theme: document.documentElement.getAttribute("data-theme") === "light"
            ? "default"
            : "dark",
          securityLevel: "strict",
        });
      }

      const marked = global.marked;
      if (marked) {
        marked.use(
          global.markedAlert(),
          {
            gfm: true,
            breaks: false,
          },
        );
      }
    })();
    return ready;
  }

  let mermaidSeq = 0;

  async function render(container, markdownText) {
    await init();

    const marked = global.marked;
    const DOMPurify = global.DOMPurify;
    const hljs = global.hljs;

    // Pre-extract mermaid code blocks so marked doesn't escape them.
    const mermaidBlocks = [];
    const fenced = markdownText.replace(
      /```mermaid\n([\s\S]*?)```/g,
      (_m, code) => {
        const id = `__mermaid_${mermaidSeq++}__`;
        mermaidBlocks.push({ id, code: code.trim() });
        return `\n\n<div class="mermaid" id="${id}"></div>\n\n`;
      },
    );

    let html = marked
      ? marked.parse(fenced)
      : `<pre>${escapeHtml(fenced)}</pre>`;

    // Render math before sanitization so KaTeX output (trusted) survives.
    html = renderMath(html);

    html = DOMPurify
      ? DOMPurify.sanitize(html, {
          ADD_TAGS: ["foreignObject", "math", "mrow", "mi", "mo", "mn", "msup", "msub", "mfrac", "annotation"],
          ADD_ATTR: ["target", "data-*"],
        })
      : html;

    container.innerHTML = html;

    // Highlight code blocks.
    if (hljs) {
      container.querySelectorAll("pre code").forEach((block) => {
        try {
          hljs.highlightElement(block);
        } catch (_) {
          /* ignore */
        }
      });
    }

    // Render mermaid diagrams.
    const mermaid = global.mermaid;
    if (mermaid && mermaidBlocks.length) {
      for (const { id, code } of mermaidBlocks) {
        const el = container.querySelector(`#${id}`);
        if (!el) continue;
        try {
          const { svg } = await mermaid.render(`mermaid-svg-${id}`, code);
          el.innerHTML = svg;
        } catch (err) {
          el.innerHTML = `<pre style="color:#ff7b7b">Mermaid error: ${escapeHtml(
            String(err && err.message ? err.message : err),
          )}</pre>`;
        }
      }
    }

    // Re-run KaTeX auto-render on the live DOM for any remaining math.
    if (global.renderMathInElement) {
      try {
        global.renderMathInElement(container, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\(", right: "\\)", display: false },
            { left: "\\[", right: "\\]", display: true },
          ],
          throwOnError: false,
        });
      } catch (_) {
        /* ignore */
      }
    }

    // Make relative links open in new tab; absolute stay as-is.
    container.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href") || "";
      if (/^(https?:|mailto:|tel:|#)/.test(href)) return;
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener");
    });
  }

  function renderMath(html) {
    // KaTeX auto-render needs a live DOM element. We render math in the
    // post-sanitization DOM pass instead. This is a no-op placeholder kept
    // for clarity; real math rendering happens after innerHTML is set.
    return html;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  global.DemoRenderer = { init, render };
})(window);
