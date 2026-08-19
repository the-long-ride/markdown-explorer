import { describe, expect, it, vi } from 'vitest';
import { installPortableContentHandlers } from '../../../../ui/src/dom/portableContentHandlers';
import { installPortableMediaViewer, openPortableMediaViewer } from '../../../../ui/src/dom/portableMediaViewer';

describe('portable export interactions', () => {
  it('copies code and keeps code/section collapse interactions host-free', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    document.body.innerHTML = `
      <div class="mdn-codeblock" data-collapsed="true">
        <button id="copy" class="mdn-copy-btn" data-copied-label="Copied"><span class="tooltip-text">Copy</span></button>
        <code>const answer = 42;</code>
        <button id="toggle" class="mdn-codeblock-toggle-btn" data-label-show-more="More" data-label-show-less="Less">More</button>
      </div>
      <section class="mdn-section" data-expanded="true"><header class="mdn-section-header"></header></section>`;

    installPortableContentHandlers(document, window);
    const ui = (window as any).UI;
    ui.copyCode(document.getElementById('copy'));
    ui.toggleCodeCollapse(document.getElementById('toggle'));
    ui.collapseAll();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith('const answer = 42;');
    expect(document.querySelector('.mdn-codeblock')?.getAttribute('data-collapsed')).toBe('false');
    expect(document.querySelector('.mdn-section')?.getAttribute('data-expanded')).toBe('false');
  });

  it('opens images in the lightweight exported media viewer and closes with Escape', () => {
    document.body.innerHTML = '<img id="hero" src="data:image/png;base64,AA==" alt="Hero">';
    const image = document.getElementById('hero') as HTMLImageElement;
    const modal = openPortableMediaViewer(image, document);
    expect(modal?.classList.contains('mdn-export-media-viewer')).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.mdn-export-media-viewer')).toBeNull();

    installPortableMediaViewer(document);
    image.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.mdn-export-media-viewer')).not.toBeNull();
  });
});
