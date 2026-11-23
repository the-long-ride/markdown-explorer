import { describe, expect, it } from 'vitest';
import { renderInline } from '../../../../ui/src/markdown/inline';

describe('renderInline youtube fallbacks', () => {
  it('falls back to plain links for youtube urls without a usable id', () => {
    for (const url of ['https://youtu.be/', 'https://www.youtube.com/watch', 'https://www.youtube.com/embed/', 'https://www.youtube.com/channel/xyz']) {
      const html = renderInline(`![v](${url})`);
      expect(html).not.toContain('<iframe');
    }
  });

  it('embeds shorts and live ids and ignores malformed start values', () => {
    expect(renderInline('![](https://www.youtube.com/shorts/abcdefgh)')).toContain('embed/abcdefgh');
    const live = renderInline('![](https://www.youtube.com/live/abcdefgh?t=xyz)');
    expect(live).toContain('embed/abcdefgh');
    expect(live).not.toContain('start=');
  });
});
