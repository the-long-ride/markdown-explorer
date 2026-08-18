// =============================================================================
// components/Modal/MediaModal.tsx — Image/SVG zoom & pan viewer
// =============================================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import { TooltipButton } from '../shared/TooltipButton';
import { ZoomInIcon, ZoomOutIcon, ResetZoomIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon, CopyIcon, SaveImageIcon, SunIcon, MoonIcon } from '../shared/icons';
import { useAppState } from '../../contexts/AppStateContext';
import { getTranslations } from '../../contexts/translations';
import { useCssVars } from '../../utils/useCssVars';
import { copyElementImageToClipboard, saveElementImageAsPng } from '../../dom/copyImage';
import { dispatchActionNotice } from '../../utils/actionNotice';
import {
  MEDIA_ZOOM_BUTTON_STEP,
  MEDIA_ZOOM_MAX,
  MEDIA_ZOOM_MIN,
  MEDIA_ZOOM_WHEEL_STEP,
} from '../../constants/limits';
import type { MediaGallery } from './mediaGallery';
import { renderMermaidToSvg } from '../Content/enhancements/mermaidRenderToSvg';
import { resolveThemeMode } from '../../utils/themeMode';

interface MediaModalProps {
  gallery: MediaGallery | null;
  onClose: () => void;
}


export function MediaModal({ gallery, onClose }: MediaModalProps) {
  const { state, setTheme } = useAppState();
  const currentLang = state.settings.language || 'en';
  const t = getTranslations(currentLang);
  const items = gallery?.items ?? [];
  const isDarkNow = resolveThemeMode(state.theme) === 'dark';

  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, panX: 0, panY: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const mediaImageRef = useRef<HTMLImageElement>(null);
  const mediaSvgRef = useRef<HTMLDivElement>(null);
  const transformVars = { '--pan-x': `${pan.x}px`, '--pan-y': `${pan.y}px`, '--zoom': zoom };
  useCssVars(mediaImageRef, transformVars);
  useCssVars(mediaSvgRef, transformVars);

  useEffect(() => {
    setCurrentIndex(gallery?.currentIndex ?? 0);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [gallery]);

  // Re-render the displayed mermaid diagram with the current theme palette when
  // the user flips theme, navigates between gallery items, or the gallery
  // changes. Preserves zoom & pan: this effect MUST NOT touch setZoom/setPan
  // (the override SVG swaps in place via innerHTML on the existing transform
  // container that already reflects --zoom / --pan-x / --pan-y via useCssVars).
  useEffect(() => {
    if (!gallery) return;
    const current = gallery.items[Math.min(currentIndex, gallery.items.length - 1)];
    if (!current || current.type !== 'svg' || !current.source) return;
    let cancelled = false;
    renderMermaidToSvg({ source: current.source, isDark: isDarkNow })
      .then(({ svgHtml }) => {
        if (!cancelled && mediaSvgRef.current) {
          mediaSvgRef.current.innerHTML = svgHtml;
        }
      })
      .catch(() => { /* ignore render errors during theme flip */ });
    return () => { cancelled = true; };
  }, [state.theme, currentIndex, gallery, isDarkNow]);

  const zoomIn = useCallback(() => setZoom((z) => Math.min(MEDIA_ZOOM_MAX, z + MEDIA_ZOOM_BUTTON_STEP)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(MEDIA_ZOOM_MIN, z - MEDIA_ZOOM_BUTTON_STEP)), []);
  const reset = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);

  const toggleTheme = useCallback(() => {
    setTheme(isDarkNow ? 'light' : 'dark');
  }, [setTheme, isDarkNow]);

  const prev = useCallback(() => {
    setCurrentIndex((i) => (i - 1 + items.length) % items.length);
    setZoom(1); setPan({ x: 0, y: 0 });
  }, [items.length]);

  const next = useCallback(() => {
    setCurrentIndex((i) => (i + 1) % items.length);
    setZoom(1); setPan({ x: 0, y: 0 });
  }, [items.length]);

  const handleCopy = useCallback(async () => {
    const item = items[Math.min(currentIndex, items.length - 1)];
    const target = item?.type === 'svg' ? mediaSvgRef.current : mediaImageRef.current;
    if (!target) return;
    try {
      const ok = await copyElementImageToClipboard(target);
      if (ok) {
        dispatchActionNotice(t.previewActions.imageCopied, 'success');
      } else {
        dispatchActionNotice(t.previewActions.copyFailed, 'error');
      }
    } catch {
      dispatchActionNotice(t.previewActions.copyFailed, 'error');
    }
  }, [currentIndex, items, t.previewActions.copyFailed, t.previewActions.imageCopied]);

  const handleSave = useCallback(async () => {
    const item = items[Math.min(currentIndex, items.length - 1)];
    const target = item?.type === 'svg' ? mediaSvgRef.current : mediaImageRef.current;
    if (!target) return;
    try {
      const fileName = item?.type === 'svg' ? 'diagram.png' : 'image.png';
      const ok = await saveElementImageAsPng(target, fileName);
      if (ok) {
        dispatchActionNotice(t.previewActions.imageSaved || 'Image saved.', 'success');
      } else {
        dispatchActionNotice(t.previewActions.imageSaveFailed || 'Failed to save image.', 'error');
      }
    } catch {
      dispatchActionNotice(t.previewActions.imageSaveFailed || 'Failed to save image.', 'error');
    }
  }, [currentIndex, items, t.previewActions.imageSaveFailed, t.previewActions.imageSaved]);

  useEffect(() => {
    if (!gallery) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && items.length > 1) prev();
      if (e.key === 'ArrowRight' && items.length > 1) next();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [gallery, items.length, onClose, prev, next]);

  useEffect(() => {
    if (!gallery || !modalRef.current) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => Math.min(MEDIA_ZOOM_MAX, Math.max(MEDIA_ZOOM_MIN, z + (e.deltaY < 0 ? MEDIA_ZOOM_WHEEL_STEP : -MEDIA_ZOOM_WHEEL_STEP))));
    };
    const modal = modalRef.current;
    modal.addEventListener('wheel', handler, { passive: false });
    return () => modal.removeEventListener('wheel', handler);
  }, [gallery, items.length]);

  if (!gallery || items.length === 0) return null;
  const item = items[Math.min(currentIndex, items.length - 1)];

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
    <div id="mediaModal" className="mdn-modal media-modal" ref={modalRef} role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <button
        className="mdn-modal-close tooltip-container"
        onClick={onClose}
        aria-label={t.tooltips.closeModal}
        data-tooltip-pos="below"
        data-tooltip-align="right"
      >
        <CloseIcon size={16} />
        <span className="tooltip-text">{t.tooltips.closeModal}</span>
      </button>

      {items.length > 1 && (
        <div className="mdn-modal-nav">
          <TooltipButton className="mdn-modal-btn mdn-modal-btn--prev" onClick={prev} tooltip={t.tooltips.previous} tooltipPos="above" icon={<ChevronLeftIcon size={24} />} />
          <TooltipButton className="mdn-modal-btn mdn-modal-btn--next" onClick={next} tooltip={t.tooltips.next} tooltipPos="above" icon={<ChevronRightIcon size={24} />} />
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
              ref={mediaImageRef}
              className="mdn-modal-content-img media-modal__transform"
              alt=""
              draggable={false}
            />
          )}
          {item.type === 'svg' && (
            <div
              className="mdn-modal-content-svg media-modal__transform"
              data-mdn-mermaid-kind={item.kind}
              ref={mediaSvgRef}
              dangerouslySetInnerHTML={{ __html: item.html ?? '' }}
            />
          )}
        </div>
      </div>

      <div className="mdn-modal-footer media-modal__footer">
        <div className="mdn-modal-toolbar">
          <TooltipButton className="mdn-modal-tool" onClick={zoomIn} tooltip={t.tooltips.zoomIn} tooltipPos="above" icon={<ZoomInIcon />} />
          <span className="mdn-modal-zoom-text">{Math.round(zoom * 100)}%</span>
          <TooltipButton className="mdn-modal-tool" onClick={zoomOut} tooltip={t.tooltips.zoomOut} tooltipPos="above" icon={<ZoomOutIcon />} />
          <TooltipButton className="mdn-modal-tool" onClick={reset} tooltip={t.tooltips.resetZoom} tooltipPos="above" icon={<ResetZoomIcon />} />
          <TooltipButton className="mdn-modal-tool" onClick={toggleTheme} tooltip={t.topbar.theme} tooltipPos="above" icon={isDarkNow ? <SunIcon /> : <MoonIcon />} />
          <TooltipButton className="mdn-modal-tool" onClick={handleCopy} tooltip={t.previewActions.copyImage} tooltipPos="above" icon={<CopyIcon size={14} />} />
          <TooltipButton className="mdn-modal-tool" onClick={handleSave} tooltip={t.previewActions.saveImagePng} tooltipPos="above" icon={<SaveImageIcon size={14} />} />
        </div>
      </div>
    </div>
  );
}
