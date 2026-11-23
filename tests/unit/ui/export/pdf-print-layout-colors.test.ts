import { describe, expect, it } from 'vitest';
import { isLightPrintColor, layoutPdfVisual } from '../../../../ui/src/export/pdf/pdfPrintLayout';

describe('pdfPrintLayout color parsing and visual layout', () => {
  it('parses rgb, rgba, named and invalid colors', () => {
    expect(isLightPrintColor('rgb(250, 250, 250)')).toBe(true);
    expect(isLightPrintColor('rgba(300 300 300 / 0.5)')).toBe(true);
    expect(isLightPrintColor('rgb(-5, 0, 0)')).toBe(false);
    expect(isLightPrintColor('black')).toBe(false);
    expect(isLightPrintColor('#ffffff')).toBe(true);
    expect(isLightPrintColor('not-a-color')).toBe(false);
    expect(isLightPrintColor(null)).toBe(false);
  });

  it('defaults missing sizes and picks landscape for wide visuals', () => {
    expect(layoutPdfVisual({ width: 0, height: 0 } as any)).toBeTruthy();
    const wide = layoutPdfVisual({ width: 2000, height: 600 } as any) as any;
    const tall = layoutPdfVisual({ width: 400, height: 800 } as any) as any;
    expect(JSON.stringify(wide)).not.toBe(JSON.stringify(tall));
  });
});
