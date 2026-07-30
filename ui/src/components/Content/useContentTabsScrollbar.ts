import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useCssVars } from '../../utils/useCssVars';

const SCROLLBAR_TRACK_INLINE_INSET = 16;

export function useContentTabsScrollbar(activePath: string | null, tabs: readonly unknown[]) {
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const scrollbarTrackRef = useRef<HTMLDivElement>(null);
  const scrollbarThumbRef = useRef<HTMLDivElement>(null);
  const scrollbarDragRef = useRef<{
    startX: number;
    startScrollLeft: number;
    maxScrollLeft: number;
    maxThumbLeft: number;
  } | null>(null);
  const [scrollbarMetrics, setScrollbarMetrics] = useState({ visible: false, thumbLeft: 0, thumbWidth: 0 });
  const [isScrollbarDragging, setIsScrollbarDragging] = useState(false);
  useCssVars(scrollbarThumbRef, {
    '--scrollbar-thumb-width': `${scrollbarMetrics.thumbWidth}px`,
    '--scrollbar-thumb-left': `${scrollbarMetrics.thumbLeft}px`,
  });

  const updateScrollbarMetrics = useCallback(() => {
    const element = tabsScrollRef.current;
    if (!element) return;
    const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
    if (maxScrollLeft <= 1) {
      setScrollbarMetrics((current) => current.visible ? { visible: false, thumbLeft: 0, thumbWidth: 0 } : current);
      return;
    }
    const trackWidth = scrollbarTrackRef.current?.clientWidth
      ?? Math.max(0, element.clientWidth - SCROLLBAR_TRACK_INLINE_INSET);
    const thumbWidth = Math.min(trackWidth, Math.max(44, (element.clientWidth / element.scrollWidth) * trackWidth));
    const maxThumbLeft = Math.max(0, trackWidth - thumbWidth);
    const thumbLeft = maxThumbLeft === 0 ? 0 : (element.scrollLeft / maxScrollLeft) * maxThumbLeft;
    setScrollbarMetrics((current) => {
      const next = { visible: true, thumbLeft, thumbWidth };
      return current.visible === next.visible
        && Math.abs(current.thumbLeft - next.thumbLeft) < 0.5
        && Math.abs(current.thumbWidth - next.thumbWidth) < 0.5
        ? current : next;
    });
  }, []);

  useLayoutEffect(() => {
    const handle = requestAnimationFrame(updateScrollbarMetrics);
    return () => cancelAnimationFrame(handle);
  }, [activePath, tabs, updateScrollbarMetrics]);

  useEffect(() => {
    const element = tabsScrollRef.current;
    if (!element) return;
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateScrollbarMetrics) : null;
    resizeObserver?.observe(element);
    window.addEventListener('resize', updateScrollbarMetrics);
    return () => { resizeObserver?.disconnect(); window.removeEventListener('resize', updateScrollbarMetrics); };
  }, [updateScrollbarMetrics]);

  const beginScrollbarDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const element = tabsScrollRef.current;
    const track = scrollbarTrackRef.current;
    if (!element || !track || !scrollbarMetrics.visible) return;
    const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
    const maxThumbLeft = Math.max(0, track.clientWidth - scrollbarMetrics.thumbWidth);
    if (maxScrollLeft <= 0 || maxThumbLeft <= 0) return;
    scrollbarDragRef.current = { startX: event.clientX, startScrollLeft: element.scrollLeft, maxScrollLeft, maxThumbLeft };
    setIsScrollbarDragging(true);
    event.preventDefault();
    event.stopPropagation();
  }, [scrollbarMetrics.thumbWidth, scrollbarMetrics.visible]);

  const handleScrollbarTrackPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const element = tabsScrollRef.current;
    const track = scrollbarTrackRef.current;
    if (!element || !track || !scrollbarMetrics.visible) return;
    const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
    const maxThumbLeft = Math.max(0, track.clientWidth - scrollbarMetrics.thumbWidth);
    if (maxScrollLeft <= 0 || maxThumbLeft <= 0) return;
    const trackRect = track.getBoundingClientRect();
    const nextThumbLeft = Math.min(maxThumbLeft, Math.max(0, event.clientX - trackRect.left - scrollbarMetrics.thumbWidth / 2));
    element.scrollLeft = (nextThumbLeft / maxThumbLeft) * maxScrollLeft;
    updateScrollbarMetrics();
    beginScrollbarDrag(event);
  }, [beginScrollbarDrag, scrollbarMetrics.thumbWidth, scrollbarMetrics.visible, updateScrollbarMetrics]);

  useEffect(() => {
    if (!isScrollbarDragging) return;
    const handlePointerMove = (event: PointerEvent) => {
      const element = tabsScrollRef.current;
      const drag = scrollbarDragRef.current;
      if (!element || !drag) return;
      const next = drag.startScrollLeft + ((event.clientX - drag.startX) / drag.maxThumbLeft) * drag.maxScrollLeft;
      element.scrollLeft = Math.min(drag.maxScrollLeft, Math.max(0, next));
      updateScrollbarMetrics();
    };
    const handlePointerUp = () => {
      scrollbarDragRef.current = null;
      setIsScrollbarDragging(false);
      updateScrollbarMetrics();
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [isScrollbarDragging, updateScrollbarMetrics]);

  return {
    tabsScrollRef, scrollbarTrackRef, scrollbarThumbRef, scrollbarMetrics,
    isScrollbarDragging, updateScrollbarMetrics, beginScrollbarDrag,
    handleScrollbarTrackPointerDown,
  };
}
