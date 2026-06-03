// =============================================================================
// components/shared/InteractiveBackground.tsx — Minimalist Custom Ticker Canvas Grid
// =============================================================================

import { useEffect, useRef } from 'react';

export function InteractiveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Track current pointer positions and velocities
  const mouse = useRef({
    x: 0,
    y: 0,
    tx: 0,
    ty: 0,
    speed: 0,
    targetSpeed: 0,
    hasMoved: false
  });

  useEffect(() => {
    // Start with pointer in center of screen before any movement
    mouse.current.tx = window.innerWidth / 2;
    mouse.current.ty = window.innerHeight / 2;
    mouse.current.x = mouse.current.tx;
    mouse.current.y = mouse.current.ty;

    const handlePointerMove = (e: PointerEvent) => {
      const canvas = canvasRef.current;
      let clientX = e.clientX;
      let clientY = e.clientY;

      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        clientX = e.clientX - rect.left;
        clientY = e.clientY - rect.top;
      }

      const dx = clientX - mouse.current.tx;
      const dy = clientY - mouse.current.ty;
      const distance = Math.sqrt(dx * dx + dy * dy);

      mouse.current.tx = clientX;
      mouse.current.ty = clientY;
      mouse.current.hasMoved = true;

      // Increase speed factor based on move distance
      mouse.current.targetSpeed = Math.min(2.5, mouse.current.targetSpeed + distance * 0.035);
    };

    window.addEventListener('pointermove', handlePointerMove);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    window.addEventListener('resize', resize);
    resize();

    // Custom lightweight requestAnimationFrame loop (replaces GSAP Ticker)
    const tick = () => {
      // Decelerate mouse movement velocity back to 0
      mouse.current.targetSpeed *= 0.94;
      
      // Interpolate pointer values for ultra-smooth motion damping
      mouse.current.x += (mouse.current.tx - mouse.current.x) * 0.08;
      mouse.current.y += (mouse.current.ty - mouse.current.y) * 0.08;
      mouse.current.speed += (mouse.current.targetSpeed - mouse.current.speed) * 0.08;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Dynamically fetch the current theme accent color (Cobalt, Orange, etc.)
      const style = getComputedStyle(document.documentElement);
      const accentColor = style.getPropertyValue('--accent').trim() || '#ff9130';

      // Parse HEX accent color to RGB
      let r = 255, g = 145, b = 48;
      if (accentColor.startsWith('#')) {
        const hex = accentColor.replace('#', '');
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
      }

      // Draw grid
      const gap = 36;
      const cols = Math.ceil(canvas.width / gap) + 1;
      const rows = Math.ceil(canvas.height / gap) + 1;

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x0 = i * gap;
          const y0 = j * gap;

          const dx = mouse.current.x - x0;
          const dy = mouse.current.y - y0;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Radius of cursor influence, expanding with movement speed
          const activeRadius = 110 + mouse.current.speed * 60;
          
          let shiftX = 0;
          let shiftY = 0;
          let size = 0.85;
          let alpha = 0.06; // Highly minimalist default dot opacity

          if (mouse.current.hasMoved && dist < activeRadius) {
            const factor = (activeRadius - dist) / activeRadius; // 0 to 1

            // Gently pull dots toward cursor (magnetic parallax)
            const pull = factor * 4.5 * (1 + mouse.current.speed * 0.7);
            shiftX = (dx / dist) * pull;
            shiftY = (dy / dist) * pull;

            // Scale size and opacity near the cursor, boosted by speed
            size = 0.85 + factor * 1.4 * (1 + mouse.current.speed * 0.5);
            alpha = 0.06 + factor * 0.16 * (1 + mouse.current.speed * 0.6);
          }

          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
          ctx.beginPath();
          ctx.arc(x0 + shiftX, y0 + shiftY, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    // Start loop
    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none', // Allow clicks to pass through
        zIndex: 0,
      }}
    />
  );
}
