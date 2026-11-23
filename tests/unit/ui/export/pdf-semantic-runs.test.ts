import { describe, expect, it } from 'vitest';
import { htmlToPdfNodes } from '../../../../ui/src/export/pdf/pdfSemantic';

describe('htmlToPdfNodes inline runs', () => {
  it('styles code and link runs and keeps empty pre blocks', () => {
    const nodes = htmlToPdfNodes('<p><code>x</code> and <a href="#">link</a><span class="tooltip-text">skip</span></p><pre></pre><p>   </p><p><span></span></p>');
    const json = JSON.stringify(nodes);
    expect(json).toContain('Roboto');
    expect(json).toContain('link');
    expect(json).not.toContain('skip');
  });

  it('falls back to text content for elements without inline runs', () => {
    const nodes = htmlToPdfNodes('<p><kbd>K</kbd><math><mi>x</mi></math>text</p><ul><li></li><li>item</li></ul>');
    expect(JSON.stringify(nodes)).toContain('item');
  });
});
