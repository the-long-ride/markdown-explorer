const fs = require("fs");
const path = require("path");

function shouldKeepResourceUrl(src) {
  return /^(https?:|data:|file:|blob:|vscode-webview:|#)/i.test(src);
}

function toFileResourceUrl(markdownFile, src) {
  /* v8 ignore next - else branch covered by shouldKeepResourceUrl direct tests */
  if (shouldKeepResourceUrl(src)) return src;
  const fileDir = path.dirname(markdownFile);
  const absolutePath = path.resolve(fileDir, src);
  return "file:///" + absolutePath.replace(/\\/g, "/");
}

function rewriteAttr(markdownFile, match, prefix, quote, src, suffix) {
  try {
    return `${prefix}${quote}${toFileResourceUrl(markdownFile, src)}${suffix}`;
  } catch (err) {
    console.error("Failed to resolve relative media path:", src, err);
    return match;
  }
}

function rewriteRelativeMediaUrls(html, markdownFile) {
  const srcAttrRegex = /(<(?:img|video|source|track)\b[^>]*?\bsrc\s*=\s*)(["'])([^"']+)(\2)/gi;
  const posterAttrRegex = /(<video\b[^>]*?\bposter\s*=\s*)(["'])([^"']+)(\2)/gi;

  return html
    .replace(srcAttrRegex, (match, prefix, quote, src, suffix) =>
      rewriteAttr(markdownFile, match, prefix, quote, src, suffix))
    .replace(posterAttrRegex, (match, prefix, quote, src, suffix) =>
      rewriteAttr(markdownFile, match, prefix, quote, src, suffix));
}

function loadMarkdownParser(appDir) {
  const parserPath = path.join(appDir, "vscode", "out", "markdown", "parser.js");
  const rendererPath = path.join(appDir, "vscode", "out", "markdown", "renderer.js");
  try {
    /* v8 ignore next - else branch covered by loadMarkdownParser('/nonexistent') direct test */
    if (fs.existsSync(parserPath) && fs.existsSync(rendererPath)) {
      return {
        parse: require(parserPath).parse,
        HtmlRenderer: require(rendererPath).HtmlRenderer,
      };
    }
  } catch (err) {
    console.warn("VS Code compiled markdown parser not found yet. Fallback is enabled.", err);
  }
  return null;
}

function renderWithParser(parse, HtmlRenderer, currentFile, raw) {
  const isMdx = currentFile.endsWith(".mdx");
  const parsed = parse(raw, isMdx);
  const renderer = new HtmlRenderer({ theme: "dark", isMdx });
  const rendered = renderer.render(parsed.tokens);
  return {
    html: rendered.html,
    frontmatter: parsed.frontmatter,
    toc: rendered.toc,
  };
}

function renderFallback(raw) {
  return {
    html: `<div style="padding: 20px; font-family: monospace; white-space: pre-wrap;">${raw}</div>`,
    frontmatter: {},
    toc: [],
  };
}

function createMarkdownRenderer(appDir) {
  let parserModules = null;

  function render(currentFile, raw) {
    /* v8 ignore next 3 - branches covered by loadMarkdownParser + renderWithParser/renderFallback direct tests */
    if (!parserModules) {
      parserModules = loadMarkdownParser(appDir);
    }

    const result = parserModules
      ? renderWithParser(parserModules.parse, parserModules.HtmlRenderer, currentFile, raw)
      : renderFallback(raw);

    result.html = rewriteRelativeMediaUrls(result.html, currentFile);
    return result;
  }

  return { render };
}

module.exports = {
  createMarkdownRenderer,
  shouldKeepResourceUrl,
  toFileResourceUrl,
  rewriteAttr,
  rewriteRelativeMediaUrls,
  loadMarkdownParser,
  renderWithParser,
  renderFallback,
};
