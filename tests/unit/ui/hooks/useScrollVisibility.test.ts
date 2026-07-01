import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScrollVisibility } from '../../../../ui/src/hooks/useScrollVisibility';

describe('useScrollVisibility', () => {
  it('returns isVisible=false when ref has no current element', () => {
    const scrollRef = { current: null };
    const { result } = renderHook(() => useScrollVisibility(scrollRef));
    expect(result.current.isVisible).toBe(false);
  });

  it('returns isVisible=false when scrollTop is below threshold', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'scrollTop', { value: 50, writable: true });
    document.body.appendChild(el);

    const scrollRef = { current: el };
    const { result } = renderHook(() => useScrollVisibility(scrollRef, 200));
    expect(result.current.isVisible).toBe(false);

    document.body.removeChild(el);
  });

  it('returns isVisible=true when scrollTop exceeds threshold', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'scrollTop', { value: 300, writable: true });
    document.body.appendChild(el);

    const scrollRef = { current: el };
    const { result } = renderHook(() => useScrollVisibility(scrollRef, 200));
    expect(result.current.isVisible).toBe(true);

    document.body.removeChild(el);
  });

  it('scrollToTop calls scrollTo on the ref element', () => {
    const el = document.createElement('div');
    el.scrollTo = vi.fn();
    document.body.appendChild(el);

    const scrollRef = { current: el };
    const { result } = renderHook(() => useScrollVisibility(scrollRef));
    act(() => {
      result.current.scrollToTop();
    });
    expect(el.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });

    document.body.removeChild(el);
  });

  it('uses default threshold of 200', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'scrollTop', { value: 199, writable: true });
    document.body.appendChild(el);

    const scrollRef = { current: el };
    const { result } = renderHook(() => useScrollVisibility(scrollRef));
    expect(result.current.isVisible).toBe(false);

    document.body.removeChild(el);
  });
});
