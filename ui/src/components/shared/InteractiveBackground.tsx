// =============================================================================
// components/shared/InteractiveBackground.tsx — Minimalist Custom Ticker Canvas Grid
// =============================================================================

import { useEffect, useRef } from 'react';
import { useAppState } from '../../contexts/AppStateContext';

export function InteractiveBackground() {
  const { state } = useAppState();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Track current pointer positions and velocities
  const mouse = useRef({
    x: 0,
    y: 0,
    tx: 0,
    ty: 0,
    speed: 0,
    targetSpeed: 0,
    hasMoved: false,
  });

  useEffect(() => {
    if (state.themeStyle === 'cyberpunk') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    mouse.current.tx = window.innerWidth / 2;
    mouse.current.ty = window.innerHeight / 2;
    mouse.current.x = mouse.current.tx;
    mouse.current.y = mouse.current.ty;

    const reducedMotionQuery =
      typeof window !== 'undefined'
        ? window.matchMedia?.('(prefers-reduced-motion: reduce)')
        : undefined;
    let prefersReducedMotion = Boolean(reducedMotionQuery?.matches);
    let rafId: number | null = null;
    let isLooping = false;
    let canvasLeft = 0;
    let canvasTop = 0;

    const updateCanvasRect = () => {
      const rect = canvas.getBoundingClientRect();
      canvasLeft = rect.left;
      canvasTop = rect.top;
    };

    const stopLoop = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      isLooping = false;
    };

    // Cache theme accent colors to avoid getComputedStyle on every frame
    let cachedR = 255;
    let cachedG = 145;
    let cachedB = 48;
    let cachedBaseFill = 'rgba(255, 145, 48, 0.06)';

    const updateAccentColor = () => {
      if (typeof document === 'undefined') return;
      const style = getComputedStyle(document.documentElement);
      const accentColor = style.getPropertyValue('--accent').trim() || '#ff9130';

      if (accentColor.startsWith('#')) {
        const hex = accentColor.replace('#', '');
        if (hex.length >= 6) {
          cachedR = parseInt(hex.substring(0, 2), 16) || 255;
          cachedG = parseInt(hex.substring(2, 4), 16) || 145;
          cachedB = parseInt(hex.substring(4, 6), 16) || 48;
        }
      } else if (accentColor.startsWith('rgb')) {
        const parts = accentColor.match(/\d+/g);
        if (parts && parts.length >= 3) {
          cachedR = Number(parts[0]);
          cachedG = Number(parts[1]);
          cachedB = Number(parts[2]);
        }
      }
      cachedBaseFill = `rgba(${cachedR}, ${cachedG}, ${cachedB}, 0.06)`;
    };

    updateAccentColor();

    const drawFrame = () => {
      if (document.hidden || prefersReducedMotion) {
        isLooping = false;
        rafId = null;
        return;
      }
      mouse.current.targetSpeed *= 0.94;
      const dx = mouse.current.tx - mouse.current.x;
      const dy = mouse.current.ty - mouse.current.y;
      mouse.current.x += dx * 0.08;
      mouse.current.y += dy * 0.08;
      mouse.current.speed += (mouse.current.targetSpeed - mouse.current.speed) * 0.08;

      const isStillDamping =
        Math.abs(dx) > 0.08 ||
        Math.abs(dy) > 0.08 ||
        mouse.current.speed > 0.005 ||
        mouse.current.targetSpeed > 0.005;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const gap = 36;
      const cols = Math.ceil(canvas.width / gap) + 1;
      const rows = Math.ceil(canvas.height / gap) + 1;
      const activeRadius = 110 + mouse.current.speed * 60;
      const hasMoved = mouse.current.hasMoved;

      // Base dots: batch all non-interactive resting dots into a single fill call
      ctx.beginPath();
      const activeDots: { x0: number; y0: number; mdx: number; mdy: number; dist: number }[] = [];

      for (let i = 0; i < cols; i++) {
        const x0 = i * gap;
        for (let j = 0; j < rows; j++) {
          const y0 = j * gap;

          if (hasMoved) {
            const mdx = mouse.current.x - x0;
            const mdy = mouse.current.y - y0;
            const dist = Math.hypot(mdx, mdy);
            if (dist < activeRadius) {
              activeDots.push({ x0, y0, mdx, mdy, dist });
              continue;
            }
          }

          ctx.moveTo(x0 + 0.85, y0);
          ctx.arc(x0, y0, 0.85, 0, Math.PI * 2);
        }
      }

      ctx.fillStyle = cachedBaseFill;
      ctx.fill();

      // Draw only the few affected active dots near the cursor
      for (const dot of activeDots) {
        const factor = (activeRadius - dot.dist) / activeRadius;
        const pull = factor * 4.5 * (1 + mouse.current.speed * 0.7);
        const shiftX = (dot.mdx / dot.dist) * pull;
        const shiftY = (dot.mdy / dot.dist) * pull;
        const size = 0.85 + factor * 1.4 * (1 + mouse.current.speed * 0.5);
        const alpha = 0.06 + factor * 0.16 * (1 + mouse.current.speed * 0.6);

        ctx.fillStyle = `rgba(${cachedR}, ${cachedG}, ${cachedB}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(dot.x0 + shiftX, dot.y0 + shiftY, size, 0, Math.PI * 2);
        ctx.fill();
      }

      if (isStillDamping && !document.hidden && !prefersReducedMotion) {
        rafId = requestAnimationFrame(drawFrame);
      } else {
        mouse.current.x = mouse.current.tx;
        mouse.current.y = mouse.current.ty;
        mouse.current.speed = 0;
        mouse.current.targetSpeed = 0;
        isLooping = false;
        rafId = null;
      }
    };

    const scheduleDraw = () => {
      if (isLooping || document.hidden || prefersReducedMotion) return;
      isLooping = true;
      rafId = requestAnimationFrame(drawFrame);
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      updateCanvasRect();
      scheduleDraw();
    };

    window.addEventListener('resize', resize);
    window.addEventListener('scroll', updateCanvasRect, { passive: true });
    resize();

    const handlePointerMove = (e: PointerEvent) => {
      const clientX = e.clientX - canvasLeft;
      const clientY = e.clientY - canvasTop;

      const dx = clientX - mouse.current.tx;
      const dy = clientY - mouse.current.ty;
      const distance = Math.hypot(dx, dy);

      mouse.current.tx = clientX;
      mouse.current.ty = clientY;
      mouse.current.hasMoved = true;
      mouse.current.targetSpeed = Math.min(2.5, mouse.current.targetSpeed + distance * 0.035);

      scheduleDraw();
    };

    const handlePointerLeave = () => {
      mouse.current.targetSpeed = 0;
      scheduleDraw();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopLoop();
      } else {
        scheduleDraw();
      }
    };

    const handleReducedMotionChange = (event: MediaQueryListEvent) => {
      prefersReducedMotion = event.matches;
      if (prefersReducedMotion) {
        stopLoop();
        mouse.current.speed = 0;
        mouse.current.targetSpeed = 0;
      } else {
        scheduleDraw();
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerleave', handlePointerLeave);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    reducedMotionQuery?.addEventListener?.('change', handleReducedMotionChange);

    let observer: MutationObserver | null = null;
    if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
      observer = new MutationObserver(() => {
        updateAccentColor();
        scheduleDraw();
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme', 'data-theme-style', 'style', 'class'],
      });
    }

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', updateCanvasRect);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      reducedMotionQuery?.removeEventListener?.('change', handleReducedMotionChange);
      if (observer) observer.disconnect();
      stopLoop();
    };
  }, [state.themeStyle]);

  if (state.themeStyle === 'cyberpunk') {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      className="interactive-background-canvas"
    />
  );
}
