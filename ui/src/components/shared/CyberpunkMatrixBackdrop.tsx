// =============================================================================
// components/shared/CyberpunkMatrixBackdrop.tsx — Ambient Cyberpunk Matrix Terminal
// Full-viewport matrix rain with horizontal terminal typo effects & real-time telemetry
// =============================================================================

import { useEffect, useRef } from 'react';
import { useAppState } from '../../contexts/AppStateContext';

const MATRIX_GLYPHS =
  'ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789ABCDEF01<>:/*+=-~#$_';

const TYPO_PHRASES = [
  '> BREACH_PROTOCOL: 0x7F // BUFFER_OVERRIDE', '> NEURAL_SYNC_ESTABLISHED [144Hz]',
  '> CYBER_LINK: LATENCY 1.2ms [ENCRYPTED]', '> ICE_BREAKER::V4.2 ARMED AND READY',
  '> ROOT_ACCESS_GRANTED // PORT: 8080', '> SYS_TELEMETRY: CORE_TEMP 41.8°C OPTIMAL',
  '> DECRYPTING_PACKET_BURST [SHA-512]...', '> DAEMON_SCAN: ALL SECURITY GATES CLEAR',
  '> MATRIX_GATEWAY // PROXY_BOUNCE [NODE_4]', '> SYNAPSE_BUS_VOLTAGE: STABLE [100%]',
  '> TRACE_ROUTE_SUPPRESSED // ANONYMOUS', '> MEMORY_DUMP: 0xDEADBEEF [COMMITTED]',
  '> VECTOR_INTRUSION_DETECTED // COUNTER_ICE', '> QUANTUM_KEY_EXCHANGE: VERIFIED [OK]',
  '> SUBROUTINE_EXECUTE // RUNTIME: OK', '> PACKET_FILTER: DROP_INVALID_SIGS',
  '> OPTICAL_STREAM: 4K_60FPS [SYNC]', '> HARDWARE_SECURITY_MODULE: ARMED',
  '> SHADOW_NET_RELAY: TRANSMITTING...', '> ZERO_DAY_EXPLOIT_PATCHED [BUILD_902]',
  '> SYNTH_AUDIO_FEED: NOISE_CANCEL [ON]', '> DATA_VAULT: SECTOR_7 UNLOCKED',
  '> CIPHER_CHAIN: 256_BIT_ELLIPTIC', '> HOST_PROBER: NO_VULNERABILITY_FOUND',
  '> TERMINAL_SESSION: USER@NET_ROOT', '> BIO_TELEMETRY: VITAL_SIGS_NOMINAL',
  '> KERNEL_WATCHDOG: HEARTBEAT_PULSE', '> BUFFER_OVERFLOW_GUARD: ACTIVE',
  '> UPLINK_BANDWIDTH: 10.4 Gbps DEDICATED', '> EMERGENCY_DISCONNECT: STANDBY',
  '> HEURISTIC_PARSER: ANOMALY_RESOLVED', '> DISTRIBUTED_NODE_CLUSTER: 64/64 PEERS',
  '> DEEP_SCAN_IN_PROGRESS [SECTOR_09]', '> ENCRYPTION_HASH: 0x9B44F2A1',
  '> ACCESS_GRANTED // JACK_IN', '> TRACE_ROUTE: 192.168.0.77',
  '> MATRIX_KERNEL::ONLINE [FREQ: 142.8MHz]', '> OVERRIDE_AUTH_VECTOR // BUFFER_VALID',
  '> SYSTEM_MONITOR: LOAD_AVERAGE [0.12 0.08]', '> NEURAL_FIREWALL: BLOCKING UNKNOWN INTRUSION',
];

const HUD_NODES = [
  '// CYBER_NET.NODE // 0x44', '// ROOT_SUBNET.SEC [LOCKED]',
  '// SECURE_RELAY.NODE [LOW_LATENCY]', '// QUANTUM_SATLINK [PING: 2ms]',
  '// SECURITY_DAEMON [MONITOR]', '// PROXY_CLUSTER [0x7F_ACTIVE]',
  '// PACKET_FIREWALL [ACTIVE]', '// CITY_GRID.PULSE [142.8MHz]',
  '// NEURAL_GATEWAY // ONLINE', '// COMM_DOCK_TRANS [OK]',
  '// FIBER_TRUNK.HUB [PORT: 443]', '// MESH_RADIO_LINK [CONNECTED]',
];

const HUD_LINKS = [
  'LINK: ONLINE // ENCRYPTED', 'LINK: ACTIVE // CIPHER: AES-512',
  'LINK: OVERCLOCK // 99.4% STABLE', 'LINK: NEURAL_SYNC // 144Hz',
  'LINK: PROTOCOL_SYS // JACK_IN', 'LINK: PROXY_BOUNCE // 0.2ms',
  'LINK: FIREWALL // INTEGRITY: 100%', 'LINK: TELEMETRY // READY',
  'LINK: CORE_TEMP // 41.8°C OPTIMAL', 'LINK: ROUTE_PING // SUPPRESSED',
  'LINK: SYNC_BUS // STREAM_STABLE', 'LINK: BIO_MONITOR // STATUS: NOMINAL',
];

interface MatrixColumn {
  x: number;
  y: number;
  speed: number;
  length: number;
  chars: string[];
  headChar: string;
  mutationCounter: number;
}

interface HorizontalTypo {
  x: number;
  y: number;
  text: string;
  typedCount: number;
  typeSpeed: number;
  typeTimer: number;
  lingerTimer: number;
  fadeAlpha: number;
  color: string;
  isComplete: boolean;
}

const TRAIL_ALPHA_BUCKETS = 32;
const DARK_TRAIL_STYLES = Array.from(
  { length: TRAIL_ALPHA_BUCKETS + 1 },
  (_, k) => `rgba(0, 240, 255, ${((k / TRAIL_ALPHA_BUCKETS) * 0.95).toFixed(3)})`,
);
const LIGHT_TRAIL_STYLES = Array.from(
  { length: TRAIL_ALPHA_BUCKETS + 1 },
  (_, k) => `rgba(255, 42, 109, ${((k / TRAIL_ALPHA_BUCKETS) * 0.85).toFixed(3)})`,
);

export function CyberpunkMatrixBackdrop() {
  const { state } = useAppState();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const themeStyle = state.themeStyle;
  const isDark =
    state.theme === 'dark' ||
    (state.theme === 'auto' &&
      (typeof window !== 'undefined'
        ? Boolean(window.matchMedia?.('(prefers-color-scheme: dark)')?.matches)
        : true));

  const isDarkRef = useRef(isDark);
  isDarkRef.current = isDark;

  useEffect(() => {
    if (themeStyle !== 'cyberpunk') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotionQuery =
      typeof window !== 'undefined'
        ? window.matchMedia?.('(prefers-reduced-motion: reduce)')
        : undefined;
    let prefersReducedMotion = Boolean(reducedMotionQuery?.matches);
    let rafId: number | null = null;
    let lastTime = 0;
    const FPS = 24;
    const frameInterval = 1000 / FPS;

    let width = 0;
    let height = 0;
    const colSpacing = 38;
    const fontSize = 13;
    let columns: MatrixColumn[] = [];
    const typos: HorizontalTypo[] = [];

    // HUD Telemetry State — Continuously changing, never stops
    let nodeTick = 0;
    let bufferTick = 0;
    let linkTick = 0;
    let currentNodeIndex = 0;
    let currentLinkIndex = 0;
    let typoCooldown = 12;
    let telemetryCycleTick = 0;
    let telemetryPhase = 0;
    const telemetryHex = ['0x4F', '0xA1', '0x7E', '0x02', '0x9C'];

    const initColumns = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const numCols = Math.ceil(width / colSpacing);
      columns = Array.from({ length: numCols }, (_, i) => {
        const length = 12 + Math.floor(Math.random() * 20);
        const chars: string[] = [];
        for (let j = 0; j < length; j++) {
          chars.push(MATRIX_GLYPHS[Math.floor(Math.random() * MATRIX_GLYPHS.length)]);
        }
        return {
          x: i * colSpacing,
          y: Math.floor(Math.random() * (height * 1.2) - height * 0.35),
          speed: 1.0 + Math.random() * 2.0,
          length,
          chars,
          headChar: MATRIX_GLYPHS[Math.floor(Math.random() * MATRIX_GLYPHS.length)],
          mutationCounter: 0,
        };
      });
    };

    const stopLoop = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    const render = (time: number) => {
      rafId = null;
      if (document.hidden || prefersReducedMotion) return;
      if (document.documentElement.dataset.themeTransitioning === 'true') {
        rafId = requestAnimationFrame(render);
        return;
      }
      if (time - lastTime < frameInterval) {
        rafId = requestAnimationFrame(render);
        return;
      }
      lastTime = time;

      ctx.clearRect(0, 0, width, height);
      ctx.font = `${fontSize}px monospace`;
      ctx.textBaseline = 'top';

      const dark = isDarkRef.current;

      // Theme-adaptive colors: Dark mode = Cyan/Green/Yellow; Light mode = Vivid Red-Pink Neon
      const headColor = dark ? '#FFFFFF' : '#FF0055';
      const trailStyles = dark ? DARK_TRAIL_STYLES : LIGHT_TRAIL_STYLES;
      const accentColor = dark ? '#FFE600' : '#FF2A6D';

      // 1a. Update columns and draw trail characters without per-character shadowBlur compositing
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        col.y += col.speed * (fontSize * 0.94 * 0.75);

        col.mutationCounter++;
        if (col.mutationCounter > 3) {
          col.mutationCounter = 0;
          const mutateIdx = Math.floor(Math.random() * col.chars.length);
          col.chars[mutateIdx] = MATRIX_GLYPHS[Math.floor(Math.random() * MATRIX_GLYPHS.length)];
          col.headChar = MATRIX_GLYPHS[Math.floor(Math.random() * MATRIX_GLYPHS.length)];
        }

        const headY = col.y;
        for (let j = 1; j < col.length; j++) {
          const charY = headY - j * fontSize;
          if (charY < -fontSize || charY > height + fontSize) continue;

          const fade = 1 - j / col.length;
          const char = col.chars[j % col.chars.length];
          if (j === 2 && i % 5 === 0) {
            ctx.fillStyle = accentColor;
          } else {
            const bucket = Math.max(0, Math.min(TRAIL_ALPHA_BUCKETS, Math.round(fade * TRAIL_ALPHA_BUCKETS)));
            ctx.fillStyle = trailStyles[bucket];
          }
          ctx.fillText(char, col.x, charY);
        }
      }

      // 1b. Draw glowing lead head characters in a single shadow batch, then reset columns
      ctx.fillStyle = headColor;
      ctx.shadowColor = dark ? 'rgba(0, 240, 255, 0.95)' : 'rgba(255, 42, 109, 0.95)';
      ctx.shadowBlur = dark ? 6 : 4;
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        const headY = col.y;
        if (headY >= -fontSize && headY <= height + fontSize) {
          ctx.fillText(col.headChar, col.x, headY);
        }
        if (headY - col.length * fontSize > height) {
          col.y = Math.floor(Math.random() * -120);
          col.speed = 1.0 + Math.random() * 2.0;
        }
      }
      ctx.shadowBlur = 0;

      // 2. Spawn and update horizontal typo effect (1-2 active lines with steady cadence)
      if (typos.length < 2 && typoCooldown > 0) {
        typoCooldown--;
      }
      if (typos.length < 2 && typoCooldown <= 0 && columns.length > 0 && height > 120) {
        const minY = 48;
        const maxY = Math.max(minY + fontSize, height - 56);
        const visibleCols = columns.filter(
          (c) => c.y >= minY && c.y <= maxY && typos.every((t) => Math.abs(t.y - c.y) > 48),
        );
        const pool = visibleCols.length > 0 ? visibleCols : columns;
        const roll = Math.random();
        let zoneCols = pool;
        if (roll < 0.45) {
          zoneCols = pool.filter((c) => c.x > width * 0.52 && c.x < Math.max(width - 260, width * 0.65));
        } else if (roll < 0.8) {
          zoneCols = pool.filter((c) => c.x >= 16 && c.x < Math.min(380, width * 0.45));
        }
        const candidates = zoneCols.length > 0 ? zoneCols : pool;
        const targetCol = candidates[Math.floor(Math.random() * candidates.length)];
        const rawY =
          targetCol.y >= minY && targetCol.y <= maxY
            ? targetCol.y
            : minY + Math.random() * (maxY - minY);
        const spawnY = Math.floor(rawY / fontSize) * fontSize;
        const phrase = TYPO_PHRASES[Math.floor(Math.random() * TYPO_PHRASES.length)];
        const maxSpawnX = Math.max(16, width - phrase.length * (fontSize * 0.62) - 24);
        const spawnX = Math.max(16, Math.min(targetCol.x, maxSpawnX));
        const typoColor = Math.random() < 0.38 ? accentColor : dark ? '#00F0FF' : '#FF0055';

        typos.push({
          x: spawnX,
          y: spawnY,
          text: phrase,
          typedCount: 0,
          typeSpeed: 1,
          typeTimer: 0,
          lingerTimer: 65 + Math.floor(Math.random() * 35),
          fadeAlpha: 1,
          color: typoColor,
          isComplete: false,
        });
        typoCooldown = typos.length === 1 ? 38 + Math.floor(Math.random() * 26) : 52 + Math.floor(Math.random() * 32);
      }

      // Draw horizontal typos
      for (let i = typos.length - 1; i >= 0; i--) {
        const typo = typos[i];

        if (!typo.isComplete) {
          typo.typeTimer++;
          if (typo.typeTimer >= typo.typeSpeed) {
            typo.typeTimer = 0;
            typo.typedCount++;
            if (typo.typedCount >= typo.text.length) {
              typo.isComplete = true;
            }
          }
        } else {
          typo.lingerTimer--;
          if (typo.lingerTimer <= 0) {
            typo.fadeAlpha -= 0.05;
            if (typo.fadeAlpha <= 0) {
              typos.splice(i, 1);
              continue;
            }
          }
        }

        const currentText = typo.text.substring(0, typo.typedCount);
        ctx.save();
        ctx.font = `700 ${fontSize}px monospace`;
        const textWidth = ctx.measureText(currentText).width;
        const cursorExtra = typo.isComplete ? 0 : fontSize * 0.7;

        ctx.globalAlpha = typo.fadeAlpha * (dark ? 0.82 : 0.85);
        ctx.fillStyle = dark ? 'rgba(11, 13, 17, 0.76)' : 'rgba(242, 235, 219, 0.82)';
        ctx.fillRect(typo.x - 4, typo.y - 2, textWidth + cursorExtra + 8, fontSize + 4);

        ctx.fillStyle = typo.color;
        ctx.globalAlpha = typo.fadeAlpha;
        ctx.shadowColor = typo.color;
        ctx.shadowBlur = dark ? 8 : 5;
        ctx.fillText(currentText, typo.x, typo.y);

        if (!typo.isComplete) {
          ctx.fillStyle = dark ? '#FFFFFF' : '#FF0055';
          ctx.fillText('█', typo.x + textWidth, typo.y);
        }

        ctx.restore();
      }

      // 3. Draw cyberdeck telemetry watermark in bottom-right corner (never stops changing)
      nodeTick++;
      if (nodeTick > 32) {
        nodeTick = 0;
        currentNodeIndex = Math.floor(Math.random() * HUD_NODES.length);
      }

      bufferTick++;
      if (bufferTick > 6) {
        bufferTick = 0;
        const hexIdx = Math.floor(Math.random() * telemetryHex.length);
        telemetryHex[hexIdx] =
          '0x' + Math.floor(Math.random() * 256).toString(16).toUpperCase().padStart(2, '0');
      }

      linkTick++;
      if (linkTick > 36) {
        linkTick = 0;
        currentLinkIndex = Math.floor(Math.random() * HUD_LINKS.length);
      }

      telemetryCycleTick++;
      if (telemetryCycleTick > 80) {
        telemetryCycleTick = 0;
        telemetryPhase = (telemetryPhase + 1) % 3;
      }
      const hudX = width - 240;
      const hudY = height - 28;
      if (hudX > 120 && hudY > 120) {
        ctx.font = '10px monospace';
        if (telemetryPhase === 0) {
          ctx.fillStyle = dark ? 'rgba(0, 240, 255, 0.75)' : 'rgba(255, 42, 109, 0.85)';
          ctx.fillText(HUD_NODES[currentNodeIndex], hudX, hudY);
        } else if (telemetryPhase === 1) {
          ctx.fillStyle = dark ? 'rgba(255, 230, 0, 0.85)' : 'rgba(217, 119, 6, 0.9)';
          ctx.fillText(`BUFFER: ${telemetryHex.slice(0, 4).join(' ')}`, hudX, hudY);
        } else {
          ctx.fillStyle = dark ? 'rgba(0, 240, 255, 0.65)' : 'rgba(255, 42, 109, 0.75)';
          ctx.fillText(HUD_LINKS[currentLinkIndex], hudX, hudY);
        }
      }
      if (!document.hidden && !prefersReducedMotion) {
        rafId = requestAnimationFrame(render);
      }
    };

    const startLoop = () => {
      if (rafId !== null || document.hidden || prefersReducedMotion) return;
      lastTime = performance.now();
      rafId = requestAnimationFrame(render);
    };

    const handleResize = () => {
      if (!prefersReducedMotion) initColumns();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) stopLoop();
      else startLoop();
    };

    const handleReducedMotionChange = (event: MediaQueryListEvent) => {
      prefersReducedMotion = event.matches;
      if (prefersReducedMotion) {
        stopLoop();
        ctx.clearRect(0, 0, width, height);
      } else {
        if (columns.length === 0) initColumns();
        startLoop();
      }
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    reducedMotionQuery?.addEventListener?.('change', handleReducedMotionChange);
    if (!prefersReducedMotion) {
      initColumns();
      startLoop();
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      reducedMotionQuery?.removeEventListener?.('change', handleReducedMotionChange);
      stopLoop();
    };
  }, [themeStyle]);

  if (themeStyle !== 'cyberpunk') return null;

  return (
    <canvas
      ref={canvasRef}
      className="cyberpunk-matrix-canvas"
      aria-hidden="true"
    />
  );
}
