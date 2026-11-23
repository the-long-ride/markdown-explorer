import { describe, expect, it } from 'vitest';
import { htmlToPdfNodes } from '../../../../../ui/src/export/pdf/pdfSemantic';

describe('htmlToPdfNodes inline runs', () => {
  it('maps code, links, line breaks, images and skipped content', () => {
    const json = JSON.stringify(htmlToPdfNodes([
      '<p><a href="https://x.dev"><strong>bold link</strong></a> <a>bare</a><br><code>c</code><span aria-hidden="true">hid</span></p>',
      '<pre>pre text</pre><img alt="pic"><img>',
      '<div aria-hidden="true">skip</div><div><span>  </span></div><section><em>deep</em></section>',
      '<blockquote><p></p></blockquote><ul><li>item <a href="#a">x</a></li></ul>',
    ].join('')));
    expect(json).toContain('bold link');
    expect(json).toContain('"link":"https://x.dev"');
    expect(json).toContain('"text":"\\n"');
    expect(json).toContain('"font":"Roboto"');
    expect(json).toContain('pre text');
    expect(json).toContain('"text":"pic"');
    expect(json).toContain('"text":"Image"');
    expect(json).not.toContain('skip');
    expect(json).toContain('deep');
  });

  it('returns no nodes for empty html', () => {
    expect(htmlToPdfNodes('')).toEqual([]);
    expect(htmlToPdfNodes('<div>   </div>')).toEqual([]);
  });
});
