import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useModalRegionAnchor } from '../../../../ui/src/utils/useModalRegionAnchor';

afterEach(() => { document.body.innerHTML = ''; vi.unstubAllGlobals(); });

describe('useModalRegionAnchor', () => {
  it('measures the header, observes resizes and cleans up', () => {
    const observers: any[] = [];
    vi.stubGlobal('ResizeObserver', class { cb: any; observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn(); constructor(cb: any) { this.cb = cb; observers.push(this); } });
    const frames: Array<() => void> = [];
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => { frames.push(cb); return frames.length; });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const top = document.createElement('div'); top.className = 'topbar';
    top.getBoundingClientRect = () => ({ bottom: 42 } as DOMRect);
    document.body.append(top);
    const { unmount } = renderHook(() => useModalRegionAnchor());
    expect(document.documentElement.style.getPropertyValue('--measured-header-bottom')).toBe('42px');
    expect(observers[0].observe).toHaveBeenCalledWith(top);
    top.remove();
    const tabbar = document.createElement('div'); tabbar.className = 'desktop-tabbar';
    tabbar.getBoundingClientRect = () => ({ bottom: Number.NaN } as DOMRect);
    document.body.append(tabbar);
    observers[0].cb();
    window.dispatchEvent(new Event('resize'));
    expect(frames).toHaveLength(1);
    frames[0]();
    expect(observers[0].unobserve).toHaveBeenCalledWith(top);
    window.dispatchEvent(new Event('resize'));
    unmount();
    expect(observers[0].disconnect).toHaveBeenCalled();
    expect(document.documentElement.style.getPropertyValue('--measured-header-bottom')).toBe('');
  });

  it('degrades without ResizeObserver or a header', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const { unmount } = renderHook(() => useModalRegionAnchor());
    unmount();
    expect(document.documentElement.style.getPropertyValue('--measured-header-bottom')).toBe('');
  });
});
