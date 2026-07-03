import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerCodeLineHandlers } from '../../../../ui/src/dom/codeLineHandlers';

function createCodeBlockFixture(lineCount: number): HTMLElement {
  const block = document.createElement('div');
  block.className = 'mdn-codeblock';

  const gutter = document.createElement('div');
  gutter.className = 'mdn-codeblock-gutter';
  for (let i = 1; i <= lineCount; i++) {
    const span = document.createElement('span');
    span.dataset.line = String(i);
    span.textContent = String(i);
    gutter.appendChild(span);
  }
  block.appendChild(gutter);

  const pre = document.createElement('pre');
  pre.className = 'mdn-pre';
  pre.dataset.codeLine = '';
  const code = document.createElement('code');
  for (let i = 1; i <= lineCount; i++) {
    code.appendChild(document.createTextNode(`line ${i}`));
    if (i < lineCount) code.appendChild(document.createTextNode('\n'));
  }
  pre.appendChild(code);
  block.appendChild(pre);

  document.body.appendChild(block);
  return block;
}

function getEventListeners(target: EventTarget): string[] {
  const types = [
    'pointerdown',
    'click',
    'pointermove',
    'pointerup',
    'pointercancel',
    'selectionchange',
    'keyup',
  ];
  const found: string[] = [];
  for (const type of types) {
    const listeners = (target as any).__eventListeners?.[type];
    if (listeners && listeners.length > 0) {
      found.push(type);
    }
  }
  return found;
}

describe('dom/codeLineHandlers registerCodeLineHandlers', () => {
  let cleanup: (() => void)[] = [];

  beforeEach(() => {
    document.body.innerHTML = '';
    cleanup = [];
  });

  afterEach(() => {
    cleanup.forEach((fn) => fn());
    cleanup = [];
    document.body.innerHTML = '';
  });

  it('installs pointerdown listener on document', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    registerCodeLineHandlers();
    expect(addSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function), true);
    addSpy.mockRestore();
  });

  it('installs click listener on document', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    registerCodeLineHandlers();
    expect(addSpy).toHaveBeenCalledWith('click', expect.any(Function), true);
    addSpy.mockRestore();
  });

  it('installs pointermove listener on document', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    registerCodeLineHandlers();
    expect(addSpy).toHaveBeenCalledWith('pointermove', expect.any(Function), true);
    addSpy.mockRestore();
  });

  it('installs pointerup listener on document', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    registerCodeLineHandlers();
    expect(addSpy).toHaveBeenCalledWith('pointerup', expect.any(Function), true);
    addSpy.mockRestore();
  });

  it('installs pointercancel listener on document', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    registerCodeLineHandlers();
    expect(addSpy).toHaveBeenCalledWith('pointercancel', expect.any(Function), true);
    addSpy.mockRestore();
  });

  it('installs selectionchange listener on document', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    registerCodeLineHandlers();
    expect(addSpy).toHaveBeenCalledWith('selectionchange', expect.any(Function));
    addSpy.mockRestore();
  });

  it('installs keyup listener on document', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    registerCodeLineHandlers();
    expect(addSpy).toHaveBeenCalledWith('keyup', expect.any(Function), true);
    addSpy.mockRestore();
  });

  describe('pointer interaction on code block', () => {
    it('sets active line on pointerdown inside code block', () => {
      registerCodeLineHandlers();
      const block = createCodeBlockFixture(5);
      const pre = block.querySelector('.mdn-pre') as HTMLElement;

      const event = new PointerEvent('pointerdown', {
        bubbles: true,
        clientY: 10,
        button: 0,
      } as PointerEventInit);
      pre.dispatchEvent(event);

      expect(block.dataset.activeLine).toBeDefined();
      expect(Number(block.dataset.activeLine)).toBeGreaterThanOrEqual(1);
    });

    it('clears active line when clicking outside code block', () => {
      registerCodeLineHandlers();
      const block = createCodeBlockFixture(5);
      block.dataset.activeLine = '3';

      const outside = document.createElement('div');
      document.body.appendChild(outside);

      const event = new PointerEvent('pointerdown', {
        bubbles: true,
        clientY: 10,
        button: 0,
      } as PointerEventInit);
      Object.defineProperty(event, 'target', { value: outside, writable: false });
      document.dispatchEvent(event);

      expect(block.dataset.activeLine).toBeUndefined();
    });

    it('sets selected lines on pointer drag', () => {
      registerCodeLineHandlers();
      const block = createCodeBlockFixture(5);
      const pre = block.querySelector('.mdn-pre') as HTMLElement;

      const downEvent = new PointerEvent('pointerdown', {
        bubbles: true,
        clientY: 0,
        button: 0,
        buttons: 1,
      } as PointerEventInit);
      Object.defineProperty(downEvent, 'target', { value: pre, writable: false });
      pre.dispatchEvent(downEvent);

      const moveEvent = new PointerEvent('pointermove', {
        bubbles: true,
        clientY: 50,
        button: 0,
        buttons: 1,
      } as PointerEventInit);
      Object.defineProperty(moveEvent, 'target', { value: pre, writable: false });
      document.dispatchEvent(moveEvent);

      expect(block.dataset.selectedStart).toBeDefined();
      expect(block.dataset.selectedEnd).toBeDefined();
    });

    it('clears drag state on pointerup', () => {
      registerCodeLineHandlers();
      const block = createCodeBlockFixture(5);
      const pre = block.querySelector('.mdn-pre') as HTMLElement;

      const downEvent = new PointerEvent('pointerdown', {
        bubbles: true,
        clientY: 0,
        button: 0,
        buttons: 1,
      } as PointerEventInit);
      Object.defineProperty(downEvent, 'target', { value: pre, writable: false });
      pre.dispatchEvent(downEvent);

      const upEvent = new PointerEvent('pointerup', {
        bubbles: true,
        clientY: 50,
      } as PointerEventInit);
      document.dispatchEvent(upEvent);

      expect(block.dataset.activeLine).toBeDefined();
    });

    it('clears drag state on pointercancel', () => {
      registerCodeLineHandlers();
      const block = createCodeBlockFixture(5);
      const pre = block.querySelector('.mdn-pre') as HTMLElement;

      const downEvent = new PointerEvent('pointerdown', {
        bubbles: true,
        clientY: 0,
        button: 0,
        buttons: 1,
      } as PointerEventInit);
      Object.defineProperty(downEvent, 'target', { value: pre, writable: false });
      pre.dispatchEvent(downEvent);

      const cancelEvent = new PointerEvent('pointercancel', {
        bubbles: true,
      } as PointerEventInit);
      document.dispatchEvent(cancelEvent);

      expect(block.dataset.activeLine).toBeDefined();
    });
  });

  describe('cleanup', () => {
    it('does not throw on repeated handler registration', () => {
      expect(() => {
        registerCodeLineHandlers();
        registerCodeLineHandlers();
      }).not.toThrow();
    });

    it('removes fixture elements without error', () => {
      registerCodeLineHandlers();
      const block = createCodeBlockFixture(3);
      expect(() => {
        block.remove();
      }).not.toThrow();
    });
  });
});
