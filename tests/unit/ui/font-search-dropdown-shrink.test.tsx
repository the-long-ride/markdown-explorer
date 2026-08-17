import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { FontSearchDropdown } from '../../../ui/src/components/Settings/FontSearchDropdown';

const fonts = Array.from({ length: 40 }, (_, i) => ({
  id: `f${i}`,
  family: `Font ${i}`,
  source: 'system' as const,
  cssFamily: `'Font ${i}'`,
}));

const t = new Proxy({}, { get: (_t, key: string) => key }) as any;

describe('FontSearchDropdown shrink bug', () => {
  afterEach(() => cleanup());

  test('max height derives from natural content height, not constrained height', () => {
    const { container } = render(
      <FontSearchDropdown value={{ source: 'default' }} fonts={fonts} t={t} onChange={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button'));
    const menu = container.ownerDocument.body.querySelector('.font-search-menu') as HTMLElement;
    expect(menu).not.toBeNull();
    // jsdom reports 0 for every height, so seed a natural height by re-measure
    // (typing filters the list and re-runs the layout effect), then shrink the
    // reported scrollHeight: repositions must keep the natural height.
    Object.defineProperty(menu, 'scrollHeight', { configurable: true, get: () => 500 });
    const input = menu.querySelector('input[type="search"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Font 1' } });
    const measured = parseFloat(menu.style.getPropertyValue('--menu-max-height'));
    expect(measured).toBe(340);
    Object.defineProperty(menu, 'scrollHeight', { configurable: true, get: () => 1 });
    window.dispatchEvent(new Event('resize'));
    const maxHeight = parseFloat(menu.style.getPropertyValue('--menu-max-height'));
    expect(maxHeight).toBe(measured);
    expect(maxHeight).toBeGreaterThan(1);
  });

  test('scrolling inside the menu does not reposition it', () => {
    const { container } = render(
      <FontSearchDropdown value={{ source: 'default' }} fonts={fonts} t={t} onChange={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button'));
    const menu = container.ownerDocument.body.querySelector('.font-search-menu') as HTMLElement;
    expect(menu).not.toBeNull();
    const before = menu.style.getPropertyValue('--menu-max-height');
    const results = menu.querySelector('.font-search-menu__results') as HTMLElement;
    fireEvent.scroll(results, { target: results });
    const after = menu.style.getPropertyValue('--menu-max-height');
    expect(after).toBe(before);
  });
});
