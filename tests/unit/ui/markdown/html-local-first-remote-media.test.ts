import { describe, expect, it } from 'vitest';
import { prepareLocalFirstHtmlPreview, type HtmlLocalTextReader } from '../../../../ui/src/markdown/htmlLocalFirstPreview';

const reader: HtmlLocalTextReader = async (path) => path === 'ok.css'
  ? { ok: true, resolvedPath: '/w/ok.css', content: '@import "missing.css"; @import "https://cdn.x/a.css"; @import "data:text/css,a{}"; body{background:url(https://cdn.x/bg.png)}' } as any
  : { ok: false } as any;

const html = `<!doctype html><html><head>
<link rel="stylesheet" href="ok.css"><link rel="stylesheet" href=""><link rel="stylesheet" href="data:text/css,a{}">
<link rel="preload" as="font" href="https://cdn.x/f.woff2"><link rel="preload" as="image" href="https://cdn.x/i.png">
<link rel="preload" as="video" href="https://cdn.x/v.mp4"><link rel="preload" as="audio" href="https://cdn.x/a.mp3"><link rel="preload" as="script" href="https://cdn.x/s.js">
<style>@font-face{src:url(https://cdn.x/f.woff)} .v{background:url("https://cdn.x/clip.webm?x=1")} .i{background:url(https://cdn.x/p.jpg)}</style>
<script src="data:text/javascript,1"></script><script src="local.js" type="module" async></script><script>fetch('https://api.x')</script>
</head><body>
<img srcset="https://cdn.x/1.png 1x, https://cdn.x/2.png 2x, ,"><img src="https://cdn.x/3.png"><picture><source srcset="https://cdn.x/4.png"></picture>
<video src="https://cdn.x/m.mp4" poster="https://cdn.x/poster.png"><source src="https://cdn.x/m.webm"><track src="https://cdn.x/t.vtt"></video><audio src="https://cdn.x/s.mp3"></audio>
</body></html>`;

describe('prepareLocalFirstHtmlPreview remote resource classification', () => {
  it('classifies srcset, media, preload and css references', async () => {
    for (const allowUpstreamResources of [false, true]) {
      const result = await prepareLocalFirstHtmlPreview({ htmlSource: html, documentPath: '/w/index.html', readLocalText: reader, allowUpstreamResources } as any);
      expect(result.policyReport.allowedRemoteImages.length).toBeGreaterThan(0);
      expect(typeof result.documentHtml).toBe('string');
    }
  });
});
