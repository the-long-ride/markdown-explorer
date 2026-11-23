import { afterEach, describe, expect, it } from 'vitest';
import { applyDesktopTypography } from '../../../../../ui/src/desktop/fonts/applyDesktopTypography';
import type { DesktopFontFamily } from '../../../../../ui/src/desktop/fonts/fontModel';

const face = (cssUrl?: string, minWeight = 400, maxWeight = 400, style: 'normal' | 'italic' = 'normal') => ({ style, minWeight, maxWeight, variable: minWeight !== maxWeight, cssUrl });
const imported = (id: string, faces: any[], cssFamily = `Imp ${id}`): DesktopFontFamily => ({ id, family: id, source: 'imported', faces, cssFamily, available: true });

afterEach(() => {
  document.getElementById('markdown-explorer-imported-fonts')?.remove();
  document.documentElement.removeAttribute('style');
  document.body.removeAttribute('style');
});

describe('applyDesktopTypography', () => {
  it('applies default variables and clears them when disabled', () => {
    applyDesktopTypography(document, {}, [], true);
    const root = document.documentElement.style;
    expect(root.getPropertyValue('--font-ui')).toContain('Be Vietnam Pro');
    expect(root.getPropertyValue('--font-mono')).toContain('JetBrains Mono');
    expect(root.getPropertyValue('--font-heading-weight')).toBe('700');
    expect(document.body.style.getPropertyValue('--font-quote-style')).toBe('italic');
    expect(document.getElementById('markdown-explorer-imported-fonts')?.textContent).toBe('');
    applyDesktopTypography(document, {}, [], false);
    expect(root.getPropertyValue('--font-ui')).toBe('');
    expect(document.getElementById('markdown-explorer-imported-fonts')).toBeNull();
  });

  it('registers approved imported font faces and rejects others', () => {
    const families = [
      imported('a', [
        face('file:///fonts/A.ttf'),
        face('blob:abc', 100, 900, 'italic'),
        face('https://local-file.localhost/x.OTF'),
        face('https://x.vscode-resource.vscode-cdn.net/f"q\n.ttf'),
        face('https://evil.example/x.ttf'),
        face('not a url'),
        face(undefined),
      ], 'Fam "Q"\\\n'),
      { id: 'sys', family: 'Arial', source: 'system', faces: [face()], cssFamily: 'Arial', available: true } as DesktopFontFamily,
      { ...imported('gone', [face('file:///g.ttf')]), available: false },
    ];
    applyDesktopTypography(document, {
      fontBindings: {
        appUi: { source: 'imported', family: 'a', id: 'a', style: 'normal', weight: 400 },
        body: { source: 'imported', family: 'a', id: 'a', style: 'italic', weight: 500, size: 15 },
        heading: { source: 'system', family: 'Arial', style: 'normal', weight: 400 },
        quote: { source: 'imported', family: 'gone', id: 'gone', style: 'normal', weight: 400 },
        code: { source: 'imported', family: 'a', id: 'a', style: 'italic', weight: 50 },
        mermaid: { source: 'system', family: 'Missing', style: 'normal', weight: 400 },
      } as any,
    }, families, true);
    const css = document.getElementById('markdown-explorer-imported-fonts')!.textContent!;
    expect(css).toContain('file:///fonts/A.ttf');
    expect(css).toContain('url("blob:abc");');
    expect(css).toContain('format("opentype")');
    expect(css).toContain('font-weight:100 900');
    expect(css).not.toContain('evil.example');
    expect(css.match(/@font-face/g)).toHaveLength(4);
    const root = document.documentElement.style;
    expect(root.getPropertyValue('--font-ui')).toContain('Fam \\"Q\\"');
    expect(root.getPropertyValue('--font-body-size')).toBe('15px');
    expect(root.getPropertyValue('--font-heading')).toContain('Arial');
    expect(root.getPropertyValue('--font-quote')).toContain('Be Vietnam Pro');
    expect(root.getPropertyValue('--font-mono')).not.toContain('Fam');
    expect(root.getPropertyValue('--font-mermaid')).not.toContain('Missing');
    applyDesktopTypography(document, {}, families, true);
    expect(document.querySelectorAll('#markdown-explorer-imported-fonts')).toHaveLength(1);
  });
});
