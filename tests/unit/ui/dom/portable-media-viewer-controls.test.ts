import { afterEach, describe, expect, it } from 'vitest';
import { installPortableMediaViewer, openPortableMediaViewer } from '../../../../ui/src/dom/portableMediaViewer';

function mount() {
  document.body.innerHTML = `
    <img id="a" src="https://x.test/a.png">
    <img id="empty">
    <div class="mdn-mermaid-wrap"><div class="mermaid"><svg id="m"><g></g></svg></div></div>
    <p id="text">t</p>`;
}

const viewer = () => document.querySelector<HTMLElement>('.mdn-export-media-viewer');
const action = (name: string) => viewer()!.querySelector<HTMLElement>(`[data-media-action="${name}"]`)!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const zoom = () => viewer()!.querySelector('.mdn-modal-zoom-text')!.textContent;
const key = (k: string) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
function pointer(type: string, x = 0, y = 0) {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  return event;
}

afterEach(() => { document.body.innerHTML = ''; });

describe('portable media viewer controls', () => {
  it('returns null for sources that are not viewable media', () => {
    mount();
    expect(openPortableMediaViewer(document.getElementById('text')!, document)).toBeNull();
    expect(openPortableMediaViewer(document.getElementById('empty')!, document)).toBeNull();
  });

  it('navigates between images and mermaid SVGs with buttons and arrow keys', () => {
    mount();
    openPortableMediaViewer(document.getElementById('a')!, document);
    expect(viewer()!.querySelector('img')).not.toBeNull();
    action('next');
    expect(viewer()!.querySelector('.mdn-modal-content-svg svg')).not.toBeNull();
    key('ArrowRight');
    expect(viewer()!.querySelector('img')).not.toBeNull();
    key('ArrowLeft');
    expect(viewer()!.querySelector('svg')).not.toBeNull();
    action('previous');
    key('Tab');
    expect(viewer()!.querySelector('img')).not.toBeNull();
    action('close');
    expect(viewer()).toBeNull();
  });

  it('zooms, resets, pans and closes from the backdrop', () => {
    mount();
    openPortableMediaViewer(document.getElementById('m')!, document);
    const prev = viewer()!.querySelector<HTMLElement>('[data-media-action="previous"]')!;
    expect(prev.hidden).toBe(false);
    action('zoom-in');
    expect(zoom()).toBe('110%');
    action('zoom-out');
    action('zoom-out');
    expect(zoom()).toBe('90%');
    action('reset');
    expect(zoom()).toBe('100%');
    const wrap = viewer()!.querySelector<HTMLElement>('.mdn-modal-content-wrap')!;
    wrap.dispatchEvent(new WheelEvent('wheel', { deltaY: -1, bubbles: true, cancelable: true }));
    expect(zoom()).toBe('110%');
    wrap.dispatchEvent(new WheelEvent('wheel', { deltaY: 1, bubbles: true, cancelable: true }));
    expect(zoom()).toBe('100%');
    wrap.dispatchEvent(pointer('pointermove', 5, 5));
    wrap.dispatchEvent(pointer('pointerdown', 10, 10));
    wrap.dispatchEvent(pointer('pointermove', 30, 40));
    expect(viewer()!.querySelector<HTMLElement>('.media-modal__transform')!.style.transform).toContain('20px');
    wrap.dispatchEvent(pointer('pointerup'));
    wrap.dispatchEvent(pointer('pointerdown', 0, 0));
    wrap.dispatchEvent(pointer('pointercancel'));
    viewer()!.querySelector<HTMLElement>('.mdn-modal-zoom-text')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(viewer()).not.toBeNull();
    viewer()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(viewer()).toBeNull();
  });

  it('hides navigation for a single item and replaces an open viewer', () => {
    document.body.innerHTML = '<img id="only" src="data:image/png;base64,AA==">';
    openPortableMediaViewer(document.getElementById('only')!, document);
    openPortableMediaViewer(document.getElementById('only')!, document);
    expect(document.querySelectorAll('.mdn-export-media-viewer')).toHaveLength(1);
    expect(viewer()!.querySelector<HTMLElement>('[data-media-action="next"]')!.hidden).toBe(true);
    key('ArrowRight');
    key('Escape');
    expect(viewer()).toBeNull();
  });

  it('opens from delegated clicks on media but ignores other clicks', () => {
    mount();
    installPortableMediaViewer(document);
    installPortableMediaViewer(document);
    document.getElementById('text')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.getElementById('text')!.firstChild!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(viewer()).toBeNull();
    document.querySelector('#m g')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(viewer()).not.toBeNull();
    viewer()!.querySelector('img, svg')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelectorAll('.mdn-export-media-viewer')).toHaveLength(1);
  });
});
