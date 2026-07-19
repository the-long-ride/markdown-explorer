import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const TRACK_INSET = 8;

export function useTabBarScrollbar(activeTabId: string, tabs: unknown[]) {
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const scrollbarTrackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startScrollLeft: number; maxScrollLeft: number; maxThumbLeft: number } | null>(null);
  const [metrics, setMetrics] = useState({ visible: false, thumbLeft: 0, thumbWidth: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const updateMetrics = useCallback(() => {
    const element = tabsScrollRef.current;
    if (!element) return;
    const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
    if (maxScrollLeft <= 1) {
      setMetrics((current) => current.visible ? { visible: false, thumbLeft: 0, thumbWidth: 0 } : current);
      return;
    }
    const trackWidth = scrollbarTrackRef.current?.clientWidth ?? Math.max(0, element.clientWidth - TRACK_INSET);
    const thumbWidth = Math.min(trackWidth, Math.max(44, (element.clientWidth / element.scrollWidth) * trackWidth));
    const maxThumbLeft = Math.max(0, trackWidth - thumbWidth);
    const thumbLeft = maxThumbLeft ? (element.scrollLeft / maxScrollLeft) * maxThumbLeft : 0;
    setMetrics((current) => {
      const next = { visible: true, thumbLeft, thumbWidth };
      return current.visible === next.visible && Math.abs(current.thumbLeft - next.thumbLeft) < 0.5 && Math.abs(current.thumbWidth - next.thumbWidth) < 0.5 ? current : next;
    });
  }, []);

  useLayoutEffect(() => { const handle = requestAnimationFrame(updateMetrics); return () => cancelAnimationFrame(handle); }, [activeTabId, tabs, updateMetrics]);
  useEffect(() => {
    const element = tabsScrollRef.current;
    if (!element) return;
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateMetrics) : null;
    observer?.observe(element);
    window.addEventListener('resize', updateMetrics);
    return () => { observer?.disconnect(); window.removeEventListener('resize', updateMetrics); };
  }, [updateMetrics]);

  const beginDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const element = tabsScrollRef.current;
    const track = scrollbarTrackRef.current;
    if (!element || !track || !metrics.visible) return;
    const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
    const maxThumbLeft = Math.max(0, track.clientWidth - metrics.thumbWidth);
    if (!maxScrollLeft || !maxThumbLeft) return;
    dragRef.current = { startX: event.clientX, startScrollLeft: element.scrollLeft, maxScrollLeft, maxThumbLeft };
    setIsDragging(true);
    event.preventDefault();
    event.stopPropagation();
  }, [metrics.thumbWidth, metrics.visible]);

  const handleTrackPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const element = tabsScrollRef.current;
    const track = scrollbarTrackRef.current;
    if (!element || !track || !metrics.visible) return;
    const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
    const maxThumbLeft = Math.max(0, track.clientWidth - metrics.thumbWidth);
    if (!maxScrollLeft || !maxThumbLeft) return;
    const rect = track.getBoundingClientRect();
    const nextLeft = Math.min(maxThumbLeft, Math.max(0, event.clientX - rect.left - metrics.thumbWidth / 2));
    element.scrollLeft = (nextLeft / maxThumbLeft) * maxScrollLeft;
    updateMetrics();
    beginDrag(event);
  }, [beginDrag, metrics.thumbWidth, metrics.visible, updateMetrics]);

  useEffect(() => {
    if (!isDragging) return;
    const move = (event: PointerEvent) => {
      const element = tabsScrollRef.current;
      const drag = dragRef.current;
      if (!element || !drag) return;
      const next = drag.startScrollLeft + ((event.clientX - drag.startX) / drag.maxThumbLeft) * drag.maxScrollLeft;
      element.scrollLeft = Math.min(drag.maxScrollLeft, Math.max(0, next));
      updateMetrics();
    };
    const end = () => { dragRef.current = null; setIsDragging(false); updateMetrics(); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); };
  }, [isDragging, updateMetrics]);

  return { tabsScrollRef, scrollbarTrackRef, scrollbarMetrics: metrics, isScrollbarDragging: isDragging, updateScrollbarMetrics: updateMetrics, beginScrollbarDrag: beginDrag, handleScrollbarTrackPointerDown: handleTrackPointerDown };
}
