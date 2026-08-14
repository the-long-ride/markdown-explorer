// =============================================================================
// dom/copyImage.ts — Image and Mermaid SVG PNG clipboard copying
// =============================================================================

export async function writeBlobToClipboard(blob: Blob): Promise<boolean> {
  if (
    typeof navigator === 'undefined'
    || !navigator.clipboard
    || typeof navigator.clipboard.write !== 'function'
    || typeof ClipboardItem === 'undefined'
  ) {
    return false;
  }
  try {
    const item = new ClipboardItem({ [blob.type || 'image/png']: blob });
    await navigator.clipboard.write([item]);
    return true;
  } catch (err) {
    console.warn('ClipboardItem write failed:', err);
    return false;
  }
}

const SANS_FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, "Noto Sans", sans-serif';
const MONO_FONT_STACK = '"Cascadia Code", "Fira Code", Consolas, "Courier New", monospace';

const fontBase64Cache = new Map<string, string>();

async function fetchUrlAsBase64(url: string): Promise<string | null> {
  if (fontBase64Cache.has(url)) return fontBase64Cache.get(url)!;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (result) fontBase64Cache.set(url, result);
        resolve(result || null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function extractDocumentFontFaceCss(): Promise<string> {
  if (typeof document === 'undefined') return '';
  const fontRules: string[] = [];

  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules || [])) {
        if (rule instanceof CSSFontFaceRule) {
          fontRules.push(rule.cssText);
        }
      }
    } catch {}
  }

  const processedRules: string[] = [];
  for (const ruleText of fontRules) {
    const match = ruleText.match(/url\((['"]?)(.*?)\1\)/);
    if (match) {
      const originalUrl = match[2];
      if (originalUrl.startsWith('data:')) {
        processedRules.push(ruleText);
      } else {
        try {
          const absoluteUrl = new URL(originalUrl, document.baseURI).href;
          const base64 = await fetchUrlAsBase64(absoluteUrl);
          if (base64) {
            processedRules.push(ruleText.replace(match[0], `url("${base64}")`));
          } else {
            processedRules.push(ruleText);
          }
        } catch {
          processedRules.push(ruleText);
        }
      }
    } else {
      processedRules.push(ruleText);
    }
  }

  return processedRules.join('\n');
}

function inlineComputedStyles(original: Element, clone: Element, fallbackFont: string) {
  const origNodes = [original, ...Array.from(original.querySelectorAll('*'))];
  const cloneNodes = [clone, ...Array.from(clone.querySelectorAll('*'))];

  for (let i = 0; i < origNodes.length && i < cloneNodes.length; i++) {
    const origEl = origNodes[i] as HTMLElement | SVGElement;
    const cloneEl = cloneNodes[i] as HTMLElement | SVGElement;
    if (!origEl || !cloneEl || typeof window.getComputedStyle !== 'function') continue;

    try {
      const style = window.getComputedStyle(origEl);
      if (!style) continue;

      const fontFamily = style.fontFamily || fallbackFont;
      const fontSize = style.fontSize;
      const fontWeight = style.fontWeight;
      const fontStyle = style.fontStyle;
      const color = style.color;
      const fill = style.fill;

      const isTextOrHost = origEl.tagName === 'text'
        || origEl.tagName === 'tspan'
        || origEl.tagName === 'foreignObject'
        || Boolean(origEl.closest?.('foreignObject'));

      if (fontFamily && isTextOrHost) {
        cloneEl.style.setProperty('font-family', fontFamily, 'important');
        if (fontSize) cloneEl.style.setProperty('font-size', fontSize, 'important');
        if (fontWeight) cloneEl.style.setProperty('font-weight', fontWeight, 'important');
        if (fontStyle) cloneEl.style.setProperty('font-style', fontStyle, 'important');
      }

      if (color && (Boolean(origEl.closest?.('foreignObject')) || origEl.tagName === 'div' || origEl.tagName === 'p' || origEl.tagName === 'span')) {
        cloneEl.style.setProperty('color', color, 'important');
      }

      if (fill && fill !== 'none' && origEl.tagName === 'text') {
        cloneEl.style.setProperty('fill', fill, 'important');
      }
    } catch {}
  }
}

export function prepareStandaloneSvgForRasterization(
  svg: SVGSVGElement,
  embeddedFontCss: string = '',
): {
  svgXml: string;
  width: number;
  height: number;
  bgColor: string;
} {
  const clone = svg.cloneNode(true) as SVGSVGElement;

  if (!clone.getAttribute('xmlns')) {
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }
  if (!clone.getAttribute('xmlns:xlink')) {
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  }

  const rect = svg.getBoundingClientRect?.() || { width: 0, height: 0 };
  const viewBox = svg.viewBox?.baseVal;
  const width = Math.max(
    32,
    Math.round(
      rect.width > 0
        ? rect.width
        : (viewBox && viewBox.width > 0 ? viewBox.width : parseFloat(svg.getAttribute('width') || '800') || 800),
    ),
  );
  const height = Math.max(
    32,
    Math.round(
      rect.height > 0
        ? rect.height
        : (viewBox && viewBox.height > 0 ? viewBox.height : parseFloat(svg.getAttribute('height') || '600') || 600),
    ),
  );

  clone.setAttribute('width', `${width}`);
  clone.setAttribute('height', `${height}`);
  if (!clone.getAttribute('viewBox') && width > 0 && height > 0) {
    clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }

  const computedStyle = typeof window !== 'undefined' && window.getComputedStyle ? window.getComputedStyle(svg) : null;
  const bgColor = computedStyle?.getPropertyValue('--bg')?.trim() || computedStyle?.backgroundColor || '';
  const rawFontFamily = computedStyle?.getPropertyValue('--font-mermaid')?.trim() || computedStyle?.fontFamily || 'sans-serif';
  const isMono = /mono|consolas|courier|fira/i.test(rawFontFamily);
  const fallbackStack = isMono ? MONO_FONT_STACK : SANS_FONT_STACK;
  const fontStack = `${rawFontFamily}, ${fallbackStack}`;

  inlineComputedStyles(svg, clone, fontStack);

  const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  styleEl.textContent = `
    ${embeddedFontCss}

    svg {
      font-family: ${fontStack};
      background-color: ${bgColor || 'transparent'};
    }

    text, tspan {
      font-family: ${fontStack} !important;
    }

    foreignObject, foreignObject * {
      font-family: ${fontStack} !important;
      -webkit-font-smoothing: antialiased;
    }

    .node text, .node foreignObject, .label, .cluster-label, .kanban-label, .kanban-item-title, .kanban-item-desc {
      font-family: ${fontStack} !important;
    }
  `;
  clone.insertBefore(styleEl, clone.firstChild);

  const svgXml = new XMLSerializer().serializeToString(clone);
  return { svgXml, width, height, bgColor };
}

export async function rasterizeSvgToPngBlob(svg: SVGSVGElement): Promise<Blob | null> {
  const embeddedFontCss = await extractDocumentFontFaceCss();
  const { svgXml, width, height, bgColor } = prepareStandaloneSvgForRasterization(svg, embeddedFontCss);
  const scale = Math.max(2, typeof window !== 'undefined' ? window.devicePixelRatio || 2 : 2);
  const canvasWidth = Math.round(width * scale);
  const canvasHeight = Math.round(height * scale);

  const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgXml);

  return new Promise<Blob | null>((resolve) => {
    const img = new Image();
    const timer = typeof window !== 'undefined'
      ? window.setTimeout(() => resolve(null), 3000)
      : null;

    img.onload = () => {
      if (timer) clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }

        if (bgColor && bgColor !== 'transparent' && bgColor !== 'rgba(0, 0, 0, 0)') {
          ctx.fillStyle = bgColor;
          ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        }

        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, width, height);

        if (typeof canvas.toBlob === 'function') {
          canvas.toBlob(resolve, 'image/png');
        } else {
          resolve(null);
        }
      } catch (err) {
        console.warn('Canvas SVG rasterization failed:', err);
        resolve(null);
      }
    };

    img.onerror = () => {
      if (timer) clearTimeout(timer);
      resolve(null);
    };

    img.src = svgDataUrl;
  });
}

export async function rasterizeImageToPngBlob(img: HTMLImageElement): Promise<Blob | null> {
  if (img.src?.startsWith('data:image/png;base64,')) {
    try {
      const res = await fetch(img.src);
      return await res.blob();
    } catch {}
  }

  const width = img.naturalWidth || img.width || 300;
  const height = img.naturalHeight || img.height || 150;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    try {
      ctx.drawImage(img, 0, 0, width, height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (blob) return blob;
    } catch {}
  }

  if (img.src) {
    try {
      const res = await fetch(img.src);
      const blob = await res.blob();
      if (blob) {
        if (blob.type === 'image/png') return blob;
        const tempImg = new Image();
        tempImg.crossOrigin = 'anonymous';
        const url = URL.createObjectURL(blob);
        const converted = await new Promise<Blob | null>((resolve) => {
          tempImg.onload = () => {
            URL.revokeObjectURL(url);
            try {
              const c = document.createElement('canvas');
              c.width = tempImg.naturalWidth || width;
              c.height = tempImg.naturalHeight || height;
              const cCtx = c.getContext('2d');
              if (cCtx) {
                cCtx.drawImage(tempImg, 0, 0);
                c.toBlob(resolve, 'image/png');
              } else {
                resolve(null);
              }
            } catch {
              resolve(null);
            }
          };
          tempImg.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(null);
          };
          tempImg.src = url;
        });
        if (converted) return converted;
        return blob;
      }
    } catch {}
  }

  return null;
}

export async function copyImageElementToClipboard(img: HTMLImageElement): Promise<boolean> {
  const blob = await rasterizeImageToPngBlob(img);
  if (!blob) return false;
  return await writeBlobToClipboard(blob);
}

export async function copySvgElementToClipboard(svg: SVGSVGElement): Promise<boolean> {
  const blob = await rasterizeSvgToPngBlob(svg);
  if (!blob) return false;
  return await writeBlobToClipboard(blob);
}

export async function copyElementImageToClipboard(
  target: HTMLElement | SVGElement,
): Promise<boolean> {
  const img = target instanceof HTMLImageElement
    ? target
    : target.querySelector?.<HTMLImageElement>('img');

  if (img) {
    return await copyImageElementToClipboard(img);
  }

  const svg = target instanceof SVGSVGElement
    ? target
    : target.querySelector?.<SVGSVGElement>('svg');

  if (svg) {
    return await copySvgElementToClipboard(svg);
  }

  return false;
}
