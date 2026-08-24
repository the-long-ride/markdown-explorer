import { describe, expect, it } from 'vitest';
import { openPortableMediaViewer } from '../../../../ui/src/dom/portableMediaViewer';

describe('portable media viewer layout', () => {
  it('uses the shared modal navigation shell for previous and next controls', () => {
    document.body.innerHTML = '<img id="one" src="data:image/png;base64,AA=="><img id="two" src="data:image/png;base64,AA==">';
    const source = document.getElementById('one') as HTMLImageElement;
    const modal = openPortableMediaViewer(source, document);

    const nav = modal?.querySelector('.mdn-modal-nav');
    expect(nav).not.toBeNull();
    expect(nav?.querySelector('[data-media-action="previous"]')).not.toBeNull();
    expect(nav?.querySelector('[data-media-action="next"]')).not.toBeNull();
    expect(nav?.querySelector('.mdn-modal-content-wrap')).toBeNull();
    expect(modal?.querySelector('.mdn-modal-content-wrap')).not.toBeNull();
  });
});
