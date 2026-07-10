import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';

const websiteScript = readFileSync(
  join(process.cwd(), 'website', 'script.js'),
  'utf8',
);

function createRect({
  left,
  top = 20,
  width,
  height = 32,
}: {
  left: number;
  top?: number;
  width: number;
  height?: number;
}) {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  } as DOMRect;
}

function createDemoDom() {
  const dom = new JSDOM(
    `
      <!doctype html>
      <html>
        <body>
          <button id="demo-btn" data-i18n="navDemo" aria-expanded="false">Demo</button>
          <div id="demo-menu" role="menu" hidden>
            <a href="app/?mode=test" role="menuitem" data-i18n="navDemoExamples">Example files</a>
            <a href="app/?mode=file" role="menuitem" data-i18n="navDemoTry">Open a file</a>
          </div>
          <span id="lang-label"></span>
        </body>
      </html>
    `,
    {
      runScripts: 'outside-only',
      url: 'https://example.com/',
    },
  );

  (dom.window as typeof dom.window & { LANGS: Record<string, Record<string, string>> }).LANGS = {
    en: {
      label: 'EN',
      navDemo: 'Demo',
      navDemoExamples: 'Example files',
      navDemoTry: 'Open a file',
    },
  };

  dom.window.eval(websiteScript);
  return dom;
}

describe('website demo dropdown', () => {
  it('opens the menu, positions it in the viewport, and closes on outside click', () => {
    const dom = createDemoDom();
    Object.defineProperty(dom.window, 'innerWidth', {
      configurable: true,
      value: 320,
    });

    const demoBtn = dom.window.document.getElementById('demo-btn') as HTMLButtonElement;
    const demoMenu = dom.window.document.getElementById('demo-menu') as HTMLDivElement;

    vi.spyOn(demoBtn, 'getBoundingClientRect').mockReturnValue(
      createRect({ left: 280, width: 120 }),
    );

    demoBtn.click();

    expect(demoMenu.hidden).toBe(false);
    expect(demoBtn.getAttribute('aria-expanded')).toBe('true');
    expect(demoMenu.dataset.open).toBe('true');
    expect(demoMenu.style.minWidth).toBe('168px');
    expect(demoMenu.style.top).toBe('58px');
    expect(demoMenu.style.left).toBe('140px');

    dom.window.document.body.dispatchEvent(
      new dom.window.MouseEvent('click', { bubbles: true }),
    );

    expect(demoMenu.hidden).toBe(true);
    expect(demoBtn.getAttribute('aria-expanded')).toBe('false');
    expect(demoMenu.dataset.open).toBeUndefined();
    expect(demoBtn.classList.contains('is-open')).toBe(false);
  });

  it('repositions the open menu when the window scrolls', () => {
    const dom = createDemoDom();
    const demoBtn = dom.window.document.getElementById('demo-btn') as HTMLButtonElement;
    const demoMenu = dom.window.document.getElementById('demo-menu') as HTMLDivElement;

    const rects = [
      createRect({ left: 24, top: 18, width: 200 }),
      createRect({ left: 48, top: 60, width: 220 }),
    ];
    let index = 0;
    vi.spyOn(demoBtn, 'getBoundingClientRect').mockImplementation(() => {
      const rect = rects[Math.min(index, rects.length - 1)];
      index += 1;
      return rect;
    });

    demoBtn.click();
    expect(demoMenu.style.left).toBe('24px');
    expect(demoMenu.style.top).toBe('56px');
    expect(demoMenu.style.minWidth).toBe('200px');

    dom.window.dispatchEvent(new dom.window.Event('scroll'));

    expect(demoMenu.style.left).toBe('48px');
    expect(demoMenu.style.top).toBe('98px');
    expect(demoMenu.style.minWidth).toBe('220px');
  });
});
