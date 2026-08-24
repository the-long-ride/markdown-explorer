import type { ExportThemeSnapshot } from '../exportTheme';

export interface PdfFontBundle {
  defaultFont: string;
  vfs: Readonly<Record<string, string>>;
  fonts: Readonly<Record<string, { normal: string; bold: string; italics: string; bolditalics: string }>>;
  warnings: readonly string[];
}

function declaration(block: string, property: string): string | null {
  const match = block.match(new RegExp(`${property}\\s*:\\s*([^;]+)`, 'i'));
  return match?.[1]?.trim() || null;
}

function cleanFamily(value: string | null): string | null {
  if (!value) return null;
  return value.split(',')[0].trim().replace(/^['"]|['"]$/g, '') || null;
}

function extension(mime: string): string {
  if (/woff2/i.test(mime)) return 'woff2';
  if (/woff/i.test(mime)) return 'woff';
  if (/otf|opentype/i.test(mime)) return 'otf';
  return 'ttf';
}

export function preparePdfFonts(theme: ExportThemeSnapshot): PdfFontBundle {
  const vfs: Record<string, string> = {};
  const faces = new Map<string, { normal?: string; bold?: string; italics?: string; bolditalics?: string }>();
  const warnings: string[] = [];
  const blocks = theme.fontFaceCss.match(/@font-face\s*\{[^}]*\}/gi) ?? [];

  blocks.forEach((block, index) => {
    const family = cleanFamily(declaration(block, 'font-family'));
    if (!family) return;
    const src = declaration(block, 'src') || '';
    const data = src.match(/data:([^;,]+)(?:;[^,]*)?;base64,([A-Za-z0-9+/=]+)/i);
    if (!data) {
      warnings.push(`Custom PDF font "${family}" is not embedded/readable; using Roboto when necessary.`);
      return;
    }
    const fileName = `mdn-pdf-font-${index + 1}.${extension(data[1])}`;
    vfs[fileName] = data[2];
    const style = (declaration(block, 'font-style') || 'normal').toLowerCase();
    const weight = Number.parseInt(declaration(block, 'font-weight') || '400', 10) || 400;
    const key = style === 'italic' ? (weight >= 600 ? 'bolditalics' : 'italics') : (weight >= 600 ? 'bold' : 'normal');
    const face = faces.get(family) ?? {};
    face[key] = fileName;
    faces.set(family, face);
  });

  const fonts: Record<string, { normal: string; bold: string; italics: string; bolditalics: string }> = {};
  for (const [family, face] of faces) {
    const fallback = face.normal || face.bold || face.italics || face.bolditalics;
    if (!fallback) continue;
    fonts[family] = {
      normal: face.normal || fallback,
      bold: face.bold || face.normal || fallback,
      italics: face.italics || face.normal || fallback,
      bolditalics: face.bolditalics || face.bold || face.italics || face.normal || fallback,
    };
  }
  const bodyFamily = cleanFamily(theme.cssVariables['--font-body'] || null);
  return { defaultFont: bodyFamily && fonts[bodyFamily] ? bodyFamily : 'Roboto', vfs, fonts, warnings };
}
