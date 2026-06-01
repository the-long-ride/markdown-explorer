const fs = require("fs");
const path = require("path");

function shouldKeepResourceUrl(src) {
  return /^(https?:|data:|file:|blob:|vscode-webview:|#)/i.test(src);
}

function toFileResourceUrl(markdownFile, src) {
  if (shouldKeepResourceUrl(src)) return src;
  const fileDir = path.dirname(markdownFile);
  const absolutePath = path.resolve(fileDir, src);
  return "file:///" + absolutePath.replace(/\\/g, "/");
}

function rewriteRelativeMediaUrls(html, markdownFile) {
  const srcAttrRegex = /(<(?:img|video|source|track)\b[^>]*?\bsrc\s*=\s*)(["'])([^"']+)(\2)/gi;
  const posterAttrRegex = /(<video\b[^>]*?\bposter\s*=\s*)(["'])([^"']+)(\2)/gi;

  const rewriteAttr = (match, prefix, quote, src, suffix) => {
    try {
      return `${prefix}${quote}${toFileResourceUrl(markdownFile, src)}${suffix}`;
    } catch (err) {
      console.error("Failed to resolve relative media path:", src, err);
      return match;
    }
  };

  return html
    .replace(srcAttrRegex, rewriteAttr)
    .replace(posterAttrRegex, rewriteAttr);
}

function createMarkdownRenderer(appDir) {
  let parse = null;
  let HtmlRenderer = null;

  function loadMarkdownParser() {
    if (parse && HtmlRenderer) return true;
    try {
      const parserPath = path.join(appDir, "vscode", "out", "markdown", "parser.js");
      const rendererPath = path.join(appDir, "vscode", "out", "markdown", "renderer.js");
      if (fs.existsSync(parserPath) && fs.existsSync(rendererPath)) {
        parse = require(parserPath).parse;
        HtmlRenderer = require(rendererPath).HtmlRenderer;
        return true;
      }
    } catch (err) {
      console.warn("VS Code compiled markdown parser not found yet. Fallback is enabled.", err);
    }
    return false;
  }

  function render(currentFile, raw) {
    let html = "";
    let frontmatter = {};
    let toc = [];

    if (loadMarkdownParser() && parse && HtmlRenderer) {
      const isMdx = currentFile.endsWith(".mdx");
      const parsed = parse(raw, isMdx);
      const renderer = new HtmlRenderer({ theme: "dark", isMdx });
      const rendered = renderer.render(parsed.tokens);
      html = rendered.html;
      frontmatter = parsed.frontmatter;
      toc = rendered.toc;
    } else {
      html = `<div style="padding: 20px; font-family: monospace; white-space: pre-wrap;">${raw}</div>`;
    }

    return {
      html: rewriteRelativeMediaUrls(html, currentFile),
      frontmatter,
      toc,
    };
  }

  return { render };
}

module.exports = { createMarkdownRenderer };
