import { describe, expect, it } from 'vitest';
import { initGlobalHandlers } from '../../../../ui/src/dom/globalHandlers';

describe('global wiki link click handler', () => {
  it('dispatches wiki navigation with fragments and inherited source paths', () => {
    initGlobalHandlers();
    const events: any[] = [];
    const listener = (event: Event) => events.push((event as CustomEvent).detail);
    window.addEventListener('mdn-wiki-navigate', listener);
    document.body.innerHTML = `
      <div data-mdn-source-document-path="docs/src.md">
        <a id="frag" class="mdn-wiki-link" data-mdn-wiki-target="Note" data-mdn-wiki-fragment="Part">n</a>
      </div>
      <a id="own" class="mdn-wiki-link" data-mdn-wiki-target="Other" data-mdn-source-document-path="own.md">o</a>
      <a id="bare" class="mdn-wiki-link" data-mdn-wiki-target="">b</a>
      <span id="plain">p</span>`;
    for (const id of ['frag', 'own', 'bare', 'plain']) document.getElementById(id)!.click();
    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    window.removeEventListener('mdn-wiki-navigate', listener);
    expect(events).toEqual([
      { rawTarget: 'Note#Part', sourceDocumentPath: 'docs/src.md' },
      { rawTarget: 'Other', sourceDocumentPath: 'own.md' },
      { rawTarget: '', sourceDocumentPath: '' },
    ]);
  });
});
