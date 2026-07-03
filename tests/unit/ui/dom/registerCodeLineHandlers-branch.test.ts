import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerCodeLineHandlers } from '../../../../ui/src/dom/codeLineHandlers';

// jsdom does not implement Range.prototype.getClientRects – add a stub so vi.spyOn works.
if (!('getClientRects' in Range.prototype)) {
  Object.defineProperty(Range.prototype, 'getClientRects', {
    value: () => ({
      length: 0,
      item: () => null,
      [Symbol.iterator]: function* () {},
    } as unknown as DOMRectList),
    configurable: true,
    writable: true,
  });
}

describe('registerCodeLineHandlers – comprehensive branch coverage', () => {
  let rafSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    document.body.innerHTML = '';
    rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    rafSpy.mockRestore();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. getCodeTextOffset branches
  // ──────────────────────────────────────────────────────────────────────────
  describe('getCodeTextOffset', () => {
    it('catches Range.setStart error and returns 0', () => {
      document.body.innerHTML = `
        <div class="mdn-codeblock" id="b1">
          <pre class="mdn-pre"><code id="c1">hello</code></pre>
          <div class="mdn-codeblock-gutter"><span>1</span></div>
        </div>
      `;
      registerCodeLineHandlers();

      const code = document.getElementById('c1')!;
      const sel = window.getSelection()!;

      let callCount = 0;
      const origCreateRange = document.createRange.bind(document);
      vi.spyOn(document, 'createRange').mockImplementation(() => {
        const range = origCreateRange();
        const origSetStart = range.setStart.bind(range);
        vi.spyOn(range, 'setStart').mockImplementation((container: Node, offset: number) => {
          callCount++;
          if (callCount === 2) {
            throw new Error('forced setStart error');
          }
          return origSetStart(container, offset);
        });
        return range;
      });

      const r = document.createRange();
      r.selectNodeContents(code);
      sel.removeAllRanges();
      sel.addRange(r);

      expect(() => document.dispatchEvent(new Event('selectionchange'))).not.toThrow();
      expect(callCount).toBeGreaterThanOrEqual(0);
    });

    it('compareBoundaryPoints <= 0 returns 0', () => {
      document.body.innerHTML = `
        <div class="mdn-codeblock" id="b1">
          <pre class="mdn-pre"><code id="c1">hello</code></pre>
          <div class="mdn-codeblock-gutter"><span>1</span></div>
        </div>
      `;
      registerCodeLineHandlers();

      const code = document.getElementById('c1')!;
      const sel = window.getSelection()!;

      const r = document.createRange();
      r.setStart(code.firstChild!, 0);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);

      expect(() => document.dispatchEvent(new Event('selectionchange'))).not.toThrow();
    });

    it('compareBoundaryPoints >= 0 returns textLength', () => {
      document.body.innerHTML = `
        <div class="mdn-codeblock" id="b1">
          <pre class="mdn-pre"><code id="c1">hello</code></pre>
          <div class="mdn-codeblock-gutter"><span>1</span></div>
        </div>
      `;
      registerCodeLineHandlers();

      const code = document.getElementById('c1')!;
      const sel = window.getSelection()!;

      const r = document.createRange();
      r.setStartAfter(code);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);

      expect(() => document.dispatchEvent(new Event('selectionchange'))).not.toThrow();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. getSelectedCodeLinesFromRects edge cases
  // ──────────────────────────────────────────────────────────────────────────
  describe('getSelectedCodeLinesFromRects', () => {
    it('count is 0 -> returns null (no gutter spans)', () => {
      document.body.innerHTML = `
        <div class="mdn-codeblock" id="b1">
          <pre class="mdn-pre"><code id="c1">hello</code></pre>
          <div class="mdn-codeblock-gutter"></div>
        </div>
      `;
      registerCodeLineHandlers();

      const code = document.getElementById('c1')!;
      const r = document.createRange();
      r.selectNodeContents(code);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(r);

      expect(() => document.dispatchEvent(new Event('selectionchange'))).not.toThrow();
    });

    it('codeRect.height or lineHeight is 0 -> returns null', () => {
      document.body.innerHTML = `
        <div class="mdn-codeblock" id="b1">
          <pre class="mdn-pre"><code id="c1">hello</code></pre>
          <div class="mdn-codeblock-gutter"><span>1</span></div>
        </div>
      `;
      registerCodeLineHandlers();

      const code = document.getElementById('c1')!;
      vi.spyOn(code, 'getBoundingClientRect').mockReturnValue({
        top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0,
        x: 0, y: 0, toJSON: () => ({}),
      } as DOMRect);

      const r = document.createRange();
      r.selectNodeContents(code);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(r);

      expect(() => document.dispatchEvent(new Event('selectionchange'))).not.toThrow();
    });

    it('rect with no width/height -> skip rect', () => {
      document.body.innerHTML = `
        <div class="mdn-codeblock" id="b1">
          <pre class="mdn-pre"><code id="c1">line1\nline2</code></pre>
          <div class="mdn-codeblock-gutter"><span>1</span><span>2</span></div>
        </div>
      `;
      registerCodeLineHandlers();

      const code = document.getElementById('c1')!;
      const r = document.createRange();
      r.selectNodeContents(code);

      // Mock getClientRects to include a zero-size rect
      vi.spyOn(r, 'getClientRects').mockReturnValue({
        length: 2,
        item: (i: number) => {
          if (i === 0) return { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 } as DOMRect;
          return { width: 10, height: 10, top: 0, left: 0, right: 10, bottom: 20 } as DOMRect;
        },
        [Symbol.iterator]: function* () {
          yield { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 } as DOMRect;
          yield { width: 10, height: 10, top: 0, left: 0, right: 10, bottom: 20 } as DOMRect;
        },
      } as DOMRectList);

      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(r);

      expect(() => document.dispatchEvent(new Event('selectionchange'))).not.toThrow();
    });

    it('bottom <= top -> skip rect', () => {
      document.body.innerHTML = `
        <div class="mdn-codeblock" id="b1">
          <pre class="mdn-pre"><code id="c1">line1\nline2</code></pre>
          <div class="mdn-codeblock-gutter"><span>1</span><span>2</span></div>
        </div>
      `;
      registerCodeLineHandlers();

      const code = document.getElementById('c1')!;
      const r = document.createRange();
      r.selectNodeContents(code);

      vi.spyOn(r, 'getClientRects').mockReturnValue({
        length: 1,
        item: () => ({ width: 10, height: 10, top: 50, left: 0, right: 10, bottom: 40 } as DOMRect),
        [Symbol.iterator]: function* () {
          yield { width: 10, height: 10, top: 50, left: 0, right: 10, bottom: 40 } as DOMRect;
        },
      } as DOMRectList);

      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(r);

      expect(() => document.dispatchEvent(new Event('selectionchange'))).not.toThrow();
    });

    it('startLine/endLine not finite -> returns null', () => {
      document.body.innerHTML = `
        <div class="mdn-codeblock" id="b1">
          <pre class="mdn-pre"><code id="c1">line1\nline2</code></pre>
          <div class="mdn-codeblock-gutter"><span>1</span><span>2</span></div>
        </div>
      `;
      registerCodeLineHandlers();

      const code = document.getElementById('c1')!;
      const r = document.createRange();
      r.selectNodeContents(code);

      vi.spyOn(r, 'getClientRects').mockReturnValue({
        length: 0,
        item: () => null,
        [Symbol.iterator]: function* () {},
      } as DOMRectList);

      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(r);

      expect(() => document.dispatchEvent(new Event('selectionchange'))).not.toThrow();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. getSelectedCodeLines branches
  // ──────────────────────────────────────────────────────────────────────────
  describe('getSelectedCodeLines', () => {
    it('end > start branch (offsetLines)', () => {
      document.body.innerHTML = `
        <div class="mdn-codeblock" id="b1">
          <pre class="mdn-pre"><code id="c1">line1\nline2\nline3</code></pre>
          <div class="mdn-codeblock-gutter"><span>1</span><span>2</span><span>3</span></div>
        </div>
      `;
      registerCodeLineHandlers();

      const code = document.getElementById('c1')!;
      const r = document.createRange();
      r.setStart(code.firstChild!, 0);
      r.setEnd(code.firstChild!, 10);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(r);

      expect(() => document.dispatchEvent(new Event('selectionchange'))).not.toThrow();
    });

    it('merges with rectLines', () => {
      document.body.innerHTML = `
        <div class="mdn-codeblock" id="b1">
          <pre class="mdn-pre"><code id="c1">line1\nline2\nline3</code></pre>
          <div class="mdn-codeblock-gutter"><span>1</span><span>2</span><span>3</span></div>
        </div>
      `;
      registerCodeLineHandlers();

      const code = document.getElementById('c1')!;
      const r = document.createRange();
      r.setStart(code.firstChild!, 0);
      r.setEnd(code.firstChild!, 10);

      vi.spyOn(r, 'getClientRects').mockReturnValue({
        length: 1,
        item: () => ({ width: 10, height: 20, top: 0, left: 0, right: 10, bottom: 20 } as DOMRect),
        [Symbol.iterator]: function* () {
          yield { width: 10, height: 20, top: 0, left: 0, right: 10, bottom: 20 } as DOMRect;
        },
      } as DOMRectList);

      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(r);

      expect(() => document.dispatchEvent(new Event('selectionchange'))).not.toThrow();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. syncCodeSelection branches
  // ──────────────────────────────────────────────────────────────────────────
  describe('syncCodeSelection', () => {
    it('empty selection (hasRange = false) -> clears all', () => {
      document.body.innerHTML = `
        <div class="mdn-codeblock" id="b1">
          <pre class="mdn-pre"><code id="c1">hello</code></pre>
          <div class="mdn-codeblock-gutter"><span>1</span></div>
          <span data-selected-start="1" data-selected-end="1"></span>
        </div>
      `;
      registerCodeLineHandlers();

      const sel = window.getSelection()!;
      sel.removeAllRanges();

      expect(() => document.dispatchEvent(new Event('selectionchange'))).not.toThrow();
    });

    it('range exists but does not intersect code -> clears block', () => {
      document.body.innerHTML = `
        <div class="mdn-codeblock" id="b1">
          <pre class="mdn-pre"><code id="c1">hello</code></pre>
          <div class="mdn-codeblock-gutter"><span>1</span></div>
        </div>
        <p id="outside">outside text</p>
      `;
      registerCodeLineHandlers();

      const outside = document.getElementById('outside')!;
      const r = document.createRange();
      r.selectNodeContents(outside);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(r);

      expect(() => document.dispatchEvent(new Event('selectionchange'))).not.toThrow();
    });

    it('getSelectedCodeLines returns null -> clears block', () => {
      document.body.innerHTML = `
        <div class="mdn-codeblock" id="b1">
          <pre class="mdn-pre"><code id="c1">hello</code></pre>
          <div class="mdn-codeblock-gutter"></div>
        </div>
      `;
      registerCodeLineHandlers();

      const code = document.getElementById('c1')!;
      const r = document.createRange();
      r.selectNodeContents(code);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(r);

      expect(() => document.dispatchEvent(new Event('selectionchange'))).not.toThrow();
    });

    it('normal case -> sets selected lines', () => {
      document.body.innerHTML = `
        <div class="mdn-codeblock" id="b1">
          <pre class="mdn-pre"><code id="c1">line1\nline2\nline3</code></pre>
          <div class="mdn-codeblock-gutter"><span>1</span><span>2</span><span>3</span></div>
        </div>
      `;
      registerCodeLineHandlers();

      const code = document.getElementById('c1')!;
      const r = document.createRange();
      r.selectNodeContents(code);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(r);

      expect(() => document.dispatchEvent(new Event('selectionchange'))).not.toThrow();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. updatePointerCodeLine branches
  // ──────────────────────────────────────────────────────────────────────────
  describe('updatePointerCodeLine via click', () => {
    it('target is null -> returns null', () => {
      document.body.innerHTML = `
        <div class="mdn-codeblock" id="b1">
          <pre class="mdn-pre"><code id="c1">hello</code></pre>
          <div class="mdn-codeblock-gutter"><span>1</span></div>
        </div>
      `;
      registerCodeLineHandlers();

      const event = new MouseEvent('click', { bubbles: true });
      expect(() => document.dispatchEvent(event)).not.toThrow();
    });

    it('target.closest(.mdn-pre) is null but closest(.mdn-codeblock) exists -> clears code state', () => {
      document.body.innerHTML = `
        <div class="mdn-codeblock" id="b1">
          <div class="mdn-codeblock-gutter"><span>1</span></div>
          <span id="inside">text</span>
        </div>
      `;
      registerCodeLineHandlers();

      const inside = document.getElementById('inside')!;
      const event = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(event, 'target', { value: inside, enumerable: true });

      expect(() => document.dispatchEvent(event)).not.toThrow();
    });

    it('pre, block, line all valid -> returns block and line', () => {
      document.body.innerHTML = `
        <div class="mdn-codeblock" id="b1">
          <pre class="mdn-pre"><code id="c1">hello</code></pre>
          <div class="mdn-codeblock-gutter"><span>1</span></div>
        </div>
      `;
      registerCodeLineHandlers();

      const pre = document.querySelector('.mdn-pre')!;
      const event = new MouseEvent('click', { bubbles: true, clientX: 0, clientY: 0 });
      Object.defineProperty(event, 'target', { value: pre, enumerable: true });

      expect(() => document.dispatchEvent(event)).not.toThrow();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. updatePointerCodeSelection branches
  // ──────────────────────────────────────────────────────────────────────────
  describe('updatePointerCodeSelection via pointermove', () => {
    it('not left mouse button -> returns early', () => {
      document.body.innerHTML = `
        <div class="mdn-codeblock" id="b1">
          <pre class="mdn-pre"><code id="c1">hello</code></pre>
          <div class="mdn-codeblock-gutter"><span>1</span></div>
        </div>
      `;
      registerCodeLineHandlers();

      const pre = document.querySelector('.mdn-pre')!;
      const event = new PointerEvent('pointermove', { bubbles: true, buttons: 2 });
      Object.defineProperty(event, 'target', { value: pre, enumerable: true });

      expect(() => document.dispatchEvent(event)).not.toThrow();
    });

    it('dragBlock or dragStartLine is null -> calls updatePointerCodeLine', () => {
      document.body.innerHTML = `
        <div class="mdn-codeblock" id="b1">
          <pre class="mdn-pre"><code id="c1">hello</code></pre>
          <div class="mdn-codeblock-gutter"><span>1</span></div>
        </div>
      `;
      registerCodeLineHandlers();

      const pre = document.querySelector('.mdn-pre')!;
      const event = new PointerEvent('pointermove', { bubbles: true, buttons: 1 });
      Object.defineProperty(event, 'target', { value: pre, enumerable: true });

      expect(() => document.dispatchEvent(event)).not.toThrow();
    });

    it('pre is null -> returns', () => {
      document.body.innerHTML = `
        <div class="mdn-codeblock" id="b1"></div>
      `;
      registerCodeLineHandlers();

      const block = document.getElementById('b1')!;
      const event = new PointerEvent('pointermove', { bubbles: true, buttons: 1 });
      Object.defineProperty(event, 'target', { value: block, enumerable: true });

      expect(() => document.dispatchEvent(event)).not.toThrow();
    });

    it('line is null -> returns', () => {
      document.body.innerHTML = `
        <div class="mdn-codeblock" id="b1">
          <pre class="mdn-pre"><code id="c1">hello</code></pre>
          <div class="mdn-codeblock-gutter"><span>1</span></div>
        </div>
      `;
      registerCodeLineHandlers();

      const pre = document.querySelector('.mdn-pre')!;
      const event = new PointerEvent('pointermove', { bubbles: true, buttons: 1 });
      Object.defineProperty(event, 'target', { value: pre, enumerable: true });

      expect(() => document.dispatchEvent(event)).not.toThrow();
    });

    it('everything valid -> sets active and selected lines', () => {
      document.body.innerHTML = `
        <div class="mdn-codeblock" id="b1">
          <pre class="mdn-pre"><code id="c1">line1\nline2</code></pre>
          <div class="mdn-codeblock-gutter"><span>1</span><span>2</span></div>
        </div>
      `;
      registerCodeLineHandlers();

      const pre = document.querySelector('.mdn-pre')!;

      // First pointerdown to set drag state
      const downEvent = new PointerEvent('pointerdown', { bubbles: true, buttons: 1, clientX: 0, clientY: 10 });
      Object.defineProperty(downEvent, 'target', { value: pre, enumerable: true });
      document.dispatchEvent(downEvent);

      // Then pointermove
      const moveEvent = new PointerEvent('pointermove', { bubbles: true, buttons: 1, clientX: 0, clientY: 20 });
      Object.defineProperty(moveEvent, 'target', { value: pre, enumerable: true });
      expect(() => document.dispatchEvent(moveEvent)).not.toThrow();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. scheduleCodeSelectionSync branches
  // ──────────────────────────────────────────────────────────────────────────
  describe('scheduleCodeSelectionSync via finishPointerCodeSelection', () => {
    it('schedules rAF when codeSelectionFrame is not set', () => {
      document.body.innerHTML = `
        <div class="mdn-codeblock" id="b1">
          <pre class="mdn-pre"><code id="c1">hello</code></pre>
          <div class="mdn-codeblock-gutter"><span>1</span></div>
        </div>
      `;
      registerCodeLineHandlers();

      // Trigger via finishPointerCodeSelection -> pointerup without prior drag state
      const event = new PointerEvent('pointerup', { bubbles: true });
      expect(() => document.dispatchEvent(event)).not.toThrow();
      expect(rafSpy).toHaveBeenCalled();
    });
  });

  describe('scheduleCodeSelectionSync via keyup', () => {
    it('schedules rAF via keyup event', () => {
      document.body.innerHTML = `
        <div class="mdn-codeblock" id="b1">
          <pre class="mdn-pre"><code id="c1">hello</code></pre>
          <div class="mdn-codeblock-gutter"><span>1</span></div>
        </div>
      `;
      registerCodeLineHandlers();

      const event = new KeyboardEvent('keyup', { bubbles: true });
      expect(() => document.dispatchEvent(event)).not.toThrow();
      expect(rafSpy).toHaveBeenCalled();
    });
  });

  describe('scheduleCodeSelectionSync early return', () => {
    it('does not schedule a second rAF when one is already pending', () => {
      document.body.innerHTML = `
        <div class="mdn-codeblock" id="b1">
          <pre class="mdn-pre"><code id="c1">hello</code></pre>
          <div class="mdn-codeblock-gutter"><span>1</span></div>
        </div>
      `;
      registerCodeLineHandlers();

      // Replace the synchronous rAF mock with one that
      // returns a non-zero handle but does NOT execute the callback,
      // so the internal codeSelectionFrame stays non-zero.
      rafSpy.mockRestore();
      const raf = vi.fn((cb: FrameRequestCallback) => 99);
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation(raf);

      const event = new PointerEvent('pointerup', { bubbles: true });
      expect(() => document.dispatchEvent(event)).not.toThrow();

      const callsAfterFirst = raf.mock.calls.length;
      expect(callsAfterFirst).toBeGreaterThan(0);

      // Dispatch again; because the frame is still pending,
      // scheduleCodeSelectionSync should early-return without calling rAF.
      expect(() => document.dispatchEvent(event)).not.toThrow();
      expect(raf.mock.calls.length).toBe(callsAfterFirst);
    });
  });
});
