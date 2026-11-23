import { describe, expect, it } from 'vitest';
import { prepareLocalFirstHtmlPreview } from '../../../../ui/src/markdown/htmlLocalFirstPreview';

describe('prepareLocalFirstHtmlPreview attribute edges', () => {
  it('keeps local script attributes except src and integrity and tolerates missing media attributes', async () => {
    const result = await prepareLocalFirstHtmlPreview({
      htmlSource: `<html><head>
        <link rel="preload" as="font" href="https://cdn.test/f.woff2"><link rel="preload" as="image" href="https://cdn.test/i.png">
        <link rel="preload" as="video" href="https://cdn.test/v.mp4"><link rel="preload" as="audio"><link rel="preload" as="style" href="x.css">
        <style></style></head><body>
        <img><img srcset=""><video></video><video poster="https://cdn.test/p.png" src="https://cdn.test/m.webm"></video><audio></audio><source>
        <a href="https://cdn.test/song.mp3">song</a>
        <script></script><script type="module" defer integrity="sha-x" src="local.js"></script></body></html>`,
      documentPath: '/w/index.html',
      readLocalText: async (src) => ({ ok: true, content: `/* ${src} */`, resolvedPath: `/w/${src}` }) as any,
    });
    expect(result.documentHtml).toContain('type="module"');
    expect(result.documentHtml).not.toContain('integrity=');
    expect(result.documentHtml).toContain('data-mdn-local-resource="/w/local.js"');
  });
});
