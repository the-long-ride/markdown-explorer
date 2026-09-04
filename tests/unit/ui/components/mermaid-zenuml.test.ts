import { describe, expect, it } from 'vitest';
import {
  enforceZenUmlFont,
  repairZenUmlTitle,
} from '../../../../ui/src/components/Content/enhancements/mermaidZenUml.ts';
import type { MermaidThemeTokens } from '../../../../ui/src/components/Content/enhancements/mermaidTheme.ts';

describe('mermaidZenUml', () => {
  const dummyTokens: MermaidThemeTokens = {
    text: '#111111',
    background: '#ffffff',
    primaryTextColor: '#111111',
    lineColor: '#333333',
    primaryColor: '#e0e0e0',
    primaryBorderColor: '#cccccc',
    secondaryColor: '#f5f5f5',
    tertiaryColor: '#fafafa',
  };

  it('enforces font family on text, tspan, and foreignObject elements', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
    text.appendChild(tspan);
    svg.appendChild(text);

    enforceZenUmlFont(svg, 'Cascadia Code');

    expect(text.style.getPropertyValue('font-family')).toContain('Cascadia Code');
    expect(tspan.style.getPropertyValue('font-family')).toContain('Cascadia Code');
  });

  it('repairs ZenUML title element and applies foreground color and font', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const titleText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    titleText.textContent = 'Order Processing Workflow';
    svg.appendChild(titleText);

    const source = `
      zenuml
      title "Order Processing Workflow"
      Customer->Order: Place order
    `;

    const repaired = repairZenUmlTitle(svg, dummyTokens, 'JetBrains Mono', source);
    expect(repaired).toBe(true);
    expect(titleText.getAttribute('data-mdn-zenuml-title')).toBe('true');
    expect(titleText.style.fontFamily).toContain('JetBrains Mono');
  });

  it('returns false when no title exists in source or svg title element is missing', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    // No title in source
    expect(repairZenUmlTitle(svg, dummyTokens, 'JetBrains Mono', 'zenuml\nA->B: Msg')).toBe(false);

    // Title in source but no matching element in svg
    expect(repairZenUmlTitle(svg, dummyTokens, 'JetBrains Mono', 'title "My Title"\nA->B: Msg')).toBe(false);
  });
});
