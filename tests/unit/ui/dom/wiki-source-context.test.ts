import { describe, expect, it, vi } from 'vitest';
import { handleWikiLinkClick } from '../../../../ui/src/dom/globalHandlers';

describe('wiki link source context', () => {
  it('inherits the source document path from the rendered document container', () => {
    document.body.innerHTML = `
      <div data-mdn-source-document-path="docs/Start.md">
        <a href="#" class="mdn-wiki-link" data-mdn-wiki-target="../Guide">Guide</a>
      </div>
    `;
    const anchor = document.querySelector('a')!;
    const navigate = vi.fn();
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'target', { value: anchor });

    expect(handleWikiLinkClick(event, navigate)).toBe(true);
    expect(navigate).toHaveBeenCalledWith('../Guide', 'docs/Start.md');
  });
});
