import { afterEach, describe, expect, test, vi } from 'vitest';
import { attachScrollFlushOnHide } from '../../../ui/src/components/Content/contentUtils';

describe('attachScrollFlushOnHide lifecycle flush', () => {
  afterEach(() => {
    // Restore the own visibilityState override back to the prototype getter.
    delete (document as any).visibilityState;
  });

  test('flushes on unload and when the document becomes hidden, not while visible', () => {
    const flush = vi.fn();
    const detach = attachScrollFlushOnHide(flush);

    document.dispatchEvent(new Event('visibilitychange'));
    expect(flush).not.toHaveBeenCalled();

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(flush).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event('beforeunload'));
    expect(flush).toHaveBeenCalledTimes(2);

    detach();
  });

  test('detach removes both listeners', () => {
    const flush = vi.fn();
    const detach = attachScrollFlushOnHide(flush);
    detach();

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('beforeunload'));
    expect(flush).not.toHaveBeenCalled();
  });
});