import { afterEach, describe, expect, it, vi } from 'vitest';
import { beginSplitPointerDrag, resolveSplitDropTarget, setSplitDropHandler } from '../../../../ui/src/split-view/splitPointerDrag';

function layout() {
  document.body.innerHTML = `
    <div class="split-document-pane" data-pane-id="primary"><div class="split-document-pane__tabs"><span id="strip">s</span>
      <div class="split-document-pane__tab-wrap" id="tab"></div></div><p id="body">b</p></div>
    <div class="split-document-pane" data-pane-id="bogus"><p id="bogus">x</p></div>
    <div class="split-document-pane" data-pane-id="secondary"><p id="sec">y</p></div>`;
}
let hit: Element | null = null;
(document as any).elementFromPoint = () => hit;
const move = (type: string, x: number, y: number) => window.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { clientX: x, clientY: y }));

afterEach(() => { document.body.innerHTML = ''; hit = null; });

describe('split pointer drag zones', () => {
  it('resolves strip, pane, invalid pane and empty hits', () => {
    layout();
    hit = document.getElementById('strip');
    expect(resolveSplitDropTarget(0, 0)).toEqual({ paneId: 'primary', zone: 'strip' });
    hit = document.getElementById('body');
    expect(resolveSplitDropTarget(0, 0)).toEqual({ paneId: 'primary', zone: 'pane' });
    hit = document.getElementById('bogus');
    expect(resolveSplitDropTarget(0, 0)).toBeNull();
    hit = null;
    expect(resolveSplitDropTarget(0, 0)).toBeNull();
  });

  it('ignores non-primary buttons, cancels on Escape and drops on strips', () => {
    layout();
    const drop = vi.fn();
    const off = setSplitDropHandler(drop);
    const payload: any = { paneId: 'secondary', filePath: '/a.md' };
    beginSplitPointerDrag({ button: 2, clientX: 0, clientY: 0 }, payload, { label: 'a' });
    expect(document.body.classList.contains('is-split-dragging')).toBe(false);
    beginSplitPointerDrag({ button: 0, clientX: 0, clientY: 0 }, payload, { label: 'a' });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    hit = null;
    move('pointermove', 50, 50);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.body.classList.contains('is-split-dragging')).toBe(false);
    beginSplitPointerDrag({ button: 0, clientX: 0, clientY: 0 }, payload, { label: 'a', source: document.getElementById('sec') });
    hit = document.getElementById('strip');
    move('pointermove', 50, 50);
    expect(document.querySelector('.is-tab-drop-target')).not.toBeNull();
    hit = document.getElementById('sec');
    move('pointermove', 60, 60);
    hit = null;
    move('pointerup', 60, 60);
    expect(drop).toHaveBeenCalledWith(payload, { paneId: 'secondary', zone: 'pane' });
    off();
    const other = vi.fn();
    const offOther = setSplitDropHandler(other);
    off();
    beginSplitPointerDrag({ button: 0, clientX: 0, clientY: 0 }, payload, { label: 'a' });
    move('pointerup', 1, 1);
    expect(other).not.toHaveBeenCalled();
    offOther();
  });
});
