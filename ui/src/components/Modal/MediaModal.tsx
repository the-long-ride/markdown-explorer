// =============================================================================
// components/Modal/MediaModal.tsx — Image/SVG zoom & pan viewer
// =============================================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '../shared/Button';
import { ZoomInIcon, ZoomOutIcon, ResetZoomIcon, ChevronLeftIcon, ChevronRightIcon } from '../shared/icons';

interface MediaItem {
  type: 'img' | 'svg';
  src?: string;
  html?: string;
}

interface MediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The clicked element — used to find all media in the content */
  clickedElement: HTMLElement | null;
}

function getClickableMedia(): { type: 'img' | 'svg'; element: HTMLElement; src?: string; html?: string }[] {
  const media: { type: 'img' | 'svg'; element: HTMLElement; src?: string; html?: string }[] = [];
  document.querySelectorAll<HTMLImageElement>('.mdn-body img').forEach((img) => {
    media.push({ type: 'img', element: img, src: img.src });
  });
  document.querySelectorAll<HTMLElement>('.mdn-body .mdn-mermaid-wrap').forEach((wrap) => {
    const svg = wrap.querySelector('svg');
    if (svg) media.push({ type: 'svg', element: wrap, html: svg.outerHTML });
  });
  return media;
}

export function MediaModal({ isOpen, onClose, clickedElement }: MediaModalProps) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, panX: 0, panY: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !clickedElement) return;
    const allMedia = getClickableMedia();
    const idx = allMedia.findIndex((m) => m.element === clickedElement);
    setItems(allMedia.map(({ type, src, html }) => ({ type, src, html })));
    setCurrentIndex(idx >= 0 ? idx : 0);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [isOpen, clickedElement]);

  const zoomIn = useCallback(() => setZoom((z) => Math.min(5, z + 0.25)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(0.25, z - 0.25)), []);
  const reset = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);

  const prev = useCallback(() => {
    setCurrentIndex((i) => (i - 1 + items.length) % items.length);
    setZoom(1); setPan({ x: 0, y: 0 });
  }, [items.length]);

  const next = useCallback(() => {
    setCurrentIndex((i) => (i + 1) % items.length);
    setZoom(1); setPan({ x: 0, y: 0 });
  }, [items.length]);

  // Keyboard
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose, prev, next]);

  // Scroll zoom
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => Math.min(5, Math.max(0.25, z + (e.deltaY < 0 ? 0.15 : -0.15))));
    };
    const wrap = wrapRef.current;
    wrap?.addEventListener('wheel', handler, { passive: false });
    return () => wrap?.removeEventListener('wheel', handler);
  }, [isOpen]);

  if (!isOpen || items.length === 0) return null;
  const item = items[currentIndex];

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { dragging: true, startX: e.clientX - pan.x, startY: e.clientY - pan.y, panX: pan.x, panY: pan.y };
    if (wrapRef.current) wrapRef.current.style.cursor = 'grabbing';
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current.dragging) return;
    setPan({ x: e.clientX - dragRef.current.startX, y: e.clientY - dragRef.current.startY });
  };
  const onMouseUp = () => {
    dragRef.current.dragging = false;
    if (wrapRef.current) wrapRef.current.style.cursor = 'grab';
  };

  return (
    <div id="mediaModal" className="mdn-modal" style={{ display: 'flex' }} role="dialog" aria-modal="true">
      <button className="mdn-modal-close tooltip-container" onClick={onClose} aria-label="Close modal">
        &times;
        <span className="tooltip-text">Close</span>
      </button>

      {items.length > 1 && (
        <div className="mdn-modal-nav">
          <Button className="mdn-modal-btn mdn-modal-btn--prev" onClick={prev} tooltip="Previous" tooltipPos="above" icon={<ChevronLeftIcon size={24} />} />
          <Button className="mdn-modal-btn mdn-modal-btn--next" onClick={next} tooltip="Next" tooltipPos="above" icon={<ChevronRightIcon size={24} />} />
        </div>
      )}

      <div
        className="mdn-modal-content-wrap"
        ref={wrapRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <div className="mdn-modal-media-container">
          {item.type === 'img' && (
            <img
              src={item.src}
              className="mdn-modal-content-img"
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
              alt=""
            />
          )}
          {item.type === 'svg' && (
            <div
              className="mdn-modal-content-svg"
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
              dangerouslySetInnerHTML={{ __html: item.html ?? '' }}
            />
          )}
        </div>
      </div>

      <div className="mdn-modal-toolbar">
        <Button className="mdn-modal-tool" onClick={zoomIn} tooltip="Zoom In" tooltipPos="above" icon={<ZoomInIcon />} />
        <span className="mdn-modal-zoom-text">{Math.round(zoom * 100)}%</span>
        <Button className="mdn-modal-tool" onClick={zoomOut} tooltip="Zoom Out" tooltipPos="above" icon={<ZoomOutIcon />} />
        <Button className="mdn-modal-tool" onClick={reset} tooltip="Reset Zoom" tooltipPos="above" icon={<ResetZoomIcon />} />
      </div>
    </div>
  );
}
