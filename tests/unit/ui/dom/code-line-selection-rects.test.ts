import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerCodeLineHandlers } from '../../../../ui/src/dom/codeLineHandlers';

if (!('getClientRects' in Range.prototype)) {
  Object.defineProperty(Range.prototype, 'getClientRects', { value: () => [], configurable: true, writable: true });
}

const rect = (top: number, bottom: number, width = 10) => ({ top, bottom, width, height: bottom - top, left: 0, right: width, x: 0, y: top }) as DOMRect;

function mount(height = 60) {
  document.body.innerHTML = `<div class="mdn-codeblock"><pre class="mdn-pre" style="line-height:20px;font-size:12px"><code>aa\nbb\ncc</code></pre><div class="mdn-codeblock-gutter"><span>1</span><span>2</span><span>3</span></div></div>`;
  const block = document.querySelector('.mdn-codeblock') as HTMLElement;
  const code = block.querySelector('code') as HTMLElement;
  code.getBoundingClientRect = () => rect(0, height, 100);
  return { block, code, text: code.firstChild as Text };
}

function select(node: Node, start: number, end: number) {
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  sel.addRange(range);
  document.dispatchEvent(new Event('selectionchange'));
}

let registered = false;
beforeEach(() => {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => { cb(0); return 0; });
  if (!registered) { registerCodeLineHandlers(); registered = true; }
});
afterEach(() => { vi.restoreAllMocks(); window.getSelection()?.removeAllRanges(); });

describe('code line selection from client rects', () => {
  it('merges partial text offsets with visible client rects', () => {
    const { block, text } = mount();
    vi.spyOn(Range.prototype, 'getClientRects').mockReturnValue([rect(0, 0, 0), rect(100, 120), rect(20, 40), rect(-10, 15)] as any);
    select(text, 4, 5);
    expect(block.dataset.selectedStart).toBe('1');
    expect(block.dataset.selectedEnd).toBe('2');
  });

  it('falls back to text offsets when rects are empty or the code has no height', () => {
    const { block, text } = mount(0);
    vi.spyOn(Range.prototype, 'getClientRects').mockReturnValue([] as any);
    select(text, 3, 5);
    expect(block.dataset.selectedStart).toBeUndefined();
    select(text, 0, text.length);
    expect(block.dataset.selectedStart).toBe('1');
    expect(block.dataset.selectedEnd).toBe('3');
    const other = mount();
    vi.spyOn(Range.prototype, 'getClientRects').mockReturnValue([rect(0, 0, 0)] as any);
    select(other.text, 0, 2);
    expect(other.block.dataset.selectedStart).toBeUndefined();
  });

  it('clears line state when clicking outside code blocks', () => {
    const { block } = mount();
    const outside = document.createElement('p');
    document.body.append(outside);
    block.dataset.activeLine = '2';
    outside.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(block.dataset.activeLine).toBeUndefined();
  });
});
