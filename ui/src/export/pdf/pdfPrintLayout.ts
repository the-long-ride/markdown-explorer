import type { ExportThemeSnapshot } from '../exportTheme';
import type { PdfVisualBlock } from './pdfModel';

export interface PdfPrintPalette {
  page: string;
  text: string;
  muted: string;
  panel: string;
  border: string;
  accent: string;
  link: string;
}

interface RgbColor { r: number; g: number; b: number; }

const PRINT_DEFAULTS: PdfPrintPalette = {
  page: '#ffffff',
  text: '#1f2328',
  muted: '#57606a',
  panel: '#f6f8fa',
  border: '#d0d7de',
  accent: '#0969da',
  link: '#0969da',
};

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function parseColor(value: string | null | undefined): RgbColor | null {
  const raw = value?.trim().toLowerCase();
  if (!raw || raw === 'none' || raw === 'transparent' || raw === 'currentcolor' || raw.startsWith('var(')) return null;
  if (raw === 'white') return { r: 255, g: 255, b: 255 };
  if (raw === 'black') return { r: 0, g: 0, b: 0 };
  const shortHex = raw.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (shortHex) return {
    r: Number.parseInt(shortHex[1] + shortHex[1], 16),
    g: Number.parseInt(shortHex[2] + shortHex[2], 16),
    b: Number.parseInt(shortHex[3] + shortHex[3], 16),
  };
  const longHex = raw.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})(?:[0-9a-f]{2})?$/i);
  if (longHex) return {
    r: Number.parseInt(longHex[1], 16),
    g: Number.parseInt(longHex[2], 16),
    b: Number.parseInt(longHex[3], 16),
  };
  const rgb = raw.match(/^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)/i);
  if (rgb) return { r: clampChannel(Number(rgb[1])), g: clampChannel(Number(rgb[2])), b: clampChannel(Number(rgb[3])) };
  return null;
}

function channelLuminance(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(color: RgbColor): number {
  return 0.2126 * channelLuminance(color.r) + 0.7152 * channelLuminance(color.g) + 0.0722 * channelLuminance(color.b);
}

function contrast(left: RgbColor, right: RgbColor): number {
  const a = luminance(left);
  const b = luminance(right);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function usableThemeColor(theme: ExportThemeSnapshot, variable: string, fallback: string, minimumContrast: number): string {
  const candidate = theme.cssVariables[variable]?.trim();
  const parsed = parseColor(candidate);
  const page = parseColor(PRINT_DEFAULTS.page)!;
  return parsed && contrast(parsed, page) >= minimumContrast ? candidate! : fallback;
}

export function isLightPrintColor(value: string | null | undefined): boolean {
  const parsed = parseColor(value);
  return parsed ? luminance(parsed) >= 0.72 : false;
}

export function buildPdfPalette(theme: ExportThemeSnapshot): PdfPrintPalette {
  const text = usableThemeColor(theme, '--tx', PRINT_DEFAULTS.text, 4.5);
  const muted = usableThemeColor(theme, '--tx-m', PRINT_DEFAULTS.muted, 3.2);
  const accent = usableThemeColor(theme, '--accent', PRINT_DEFAULTS.accent, 3);
  const link = parseColor(accent) && contrast(parseColor(accent)!, parseColor(PRINT_DEFAULTS.page)!) >= 4.5
    ? accent
    : PRINT_DEFAULTS.link;
  return {
    page: PRINT_DEFAULTS.page,
    text,
    muted,
    panel: PRINT_DEFAULTS.panel,
    border: PRINT_DEFAULTS.border,
    accent,
    link,
  };
}

export function layoutPdfVisual(block: Pick<PdfVisualBlock, 'width' | 'height'>): {
  fit: [number, number];
  orientation: 'portrait' | 'landscape';
} {
  const width = Math.max(1, block.width || 640);
  const height = Math.max(1, block.height || 360);
  const ratio = width / height;
  const landscape = ratio >= 2 || (width >= 1200 && ratio >= 1.6);
  return landscape
    ? { fit: [730, 470], orientation: 'landscape' }
    : { fit: [500, 640], orientation: 'portrait' };
}
