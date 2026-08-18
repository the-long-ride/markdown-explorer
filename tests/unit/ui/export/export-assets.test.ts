import { afterEach, describe, expect, it, vi } from 'vitest';
import { embedExportLocalAssets } from '../../../../ui/src/export/exportHtml';

describe('embedExportLocalAssets', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('embeds relative local images as data URLs when the runtime can read them', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      expect(url).toContain('/workspace/docs/images/pic.png');
      return new Response('png-bytes', {
        status: 200,
        headers: { 'content-type': 'image/png' },
      });
    }));

    const html = await embedExportLocalAssets(
      '<p><img src="./images/pic.png" alt="pic"></p>',
      '/workspace/docs/readme.md',
    );

    expect(html).toContain('src="data:image/png;base64,');
    expect(html).toContain('alt="pic"');
  });

  it('leaves remote URLs unchanged and fails soft when local reads fail', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('blocked'); });
    vi.stubGlobal('fetch', fetchMock);

    const html = await embedExportLocalAssets(
      '<img src="https://example.com/a.png"><img src="./missing.png">',
      '/workspace/docs/readme.md',
    );

    expect(html).toContain('src="https://example.com/a.png"');
    expect(html).toContain('src="./missing.png"');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
