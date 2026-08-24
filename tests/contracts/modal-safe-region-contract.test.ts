import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('app modal safe region contract', () => {
  it('uses the app-header-safe modal region for Scope View, Export Center, and Settings', () => {
    const scope = source('ui/src/components/Modal/ScopeViewModal.tsx');
    const exportCenter = source('ui/src/components/Export/ExportCenterModal.tsx');
    const settings = source('ui/src/components/Settings/SettingsModal.tsx');

    expect(scope).toContain('mdn-app-modal-region scope-view');
    expect(exportCenter).toContain('mdn-app-modal-region export-center');
    expect(settings).toContain('mdn-app-modal-region settings-modal');
  });

  it('centers the shared modal region below the application header', () => {
    const dialogCss = source('ui/src/styles/global/global-dialog-surfaces.css');
    const block = dialogCss.match(/\.mdn-app-modal-region\s*\{([^}]*)\}/s)?.[1] ?? '';
    // The region anchors to --modal-region-top, which is the lower bound of the
    // modeled header geometry and the live measured header bottom edge. This
    // keeps a visible gap at any zoom level and in every theme.
    expect(block).toMatch(/top:\s*var\(--modal-region-top\)/);
    expect(block).toMatch(/bottom:\s*0/);
    expect(block).toMatch(/align-items:\s*center/);
    expect(block).toMatch(/justify-content:\s*center/);

    const rootVars = dialogCss.match(/:root\s*\{([^}]*)\}/s)?.[1] ?? '';
    expect(rootVars).toMatch(/--app-header-offset:\s*0px/);
    expect(rootVars).toMatch(/--measured-header-bottom:\s*0px/);
    expect(rootVars).toMatch(/--modal-region-top:\s*max\(calc\(var\(--topbar-h,\s*44px\)\s*\+\s*var\(--app-header-offset\)\),\s*var\(--measured-header-bottom\)\)/);
  });

  it('keeps a guaranteed gap between the header bar and every major modal card', () => {
    const dialogCss = source('ui/src/styles/global/global-dialog-surfaces.css');
    const scopeBlock = dialogCss.match(/\.mdn-app-modal-region \.scope-view__card\s*\{([^}]*)\}/s)?.[1] ?? '';
    const exportBlock = dialogCss.match(/\.mdn-app-modal-region \.export-center__card\s*\{([^}]*)\}/s)?.[1] ?? '';
    const settingsBlock = dialogCss.match(/\.mdn-app-modal-region \.settings-card--settings\s*\{([^}]*)\}/s)?.[1] ?? '';
    for (const block of [scopeBlock, exportBlock, settingsBlock]) {
      expect(block).toMatch(/var\(--modal-region-top\)/);
    }
  });

  it('measures the real header bottom edge so zoom cannot collapse the modal gap', () => {
    const hook = source('ui/src/utils/useModalRegionAnchor.ts');
    expect(hook).toContain('--measured-header-bottom');
    expect(hook).toContain('ResizeObserver');
    expect(hook).toContain("'.topbar')");
    expect(hook).toContain("'.desktop-tabbar'");
  });

  it('declares the floating header offset in every theme that insets the topbar', () => {
    const foundation = source('ui/src/styles/tokens/tokens-style-foundation.css');
    const vivid = source('ui/src/styles/tokens/tokens-style-vivid.css');
    // glass (8px), bento (10px), vercel (8px) float their topbar with a top margin.
    const glassBlock = foundation.match(/\[data-theme-style="glass"\]\s*\{([^}]*)\}/s)?.[1] ?? '';
    const bentoBlock = foundation.match(/\[data-theme-style="bento"\]\s*\{([^}]*)\}/s)?.[1] ?? '';
    const vercelBlock = foundation.match(/\[data-theme-style="vercel"\]\s*\{([^}]*)\}/s)?.[1] ?? '';
    const tokyoBlock = vivid.match(/\[data-theme-style="tokyo-night"\]\s*\{([^}]*)\}/s)?.[1] ?? '';
    expect(glassBlock).toMatch(/--app-header-offset:\s*8px/);
    expect(bentoBlock).toMatch(/--app-header-offset:\s*10px/);
    expect(vercelBlock).toMatch(/--app-header-offset:\s*8px/);
    expect(tokyoBlock).toMatch(/--app-header-offset/);
  });

  it('bounds all three modal cards against the remaining dynamic viewport height', () => {
    const dialogCss = source('ui/src/styles/global/global-dialog-surfaces.css');
    for (const selector of ['scope-view__card', 'export-center__card', 'settings-card--settings']) {
      const block = dialogCss.match(new RegExp(`\\.mdn-app-modal-region \\.${selector}\\s*\\{([^}]*)\\}`, 's'))?.[1] ?? '';
      expect(block).toMatch(/100dvh/);
      expect(block).toMatch(/var\(--modal-region-top\)/);
    }
  });

  it('gives Export Center the same preferred modal height as Settings', () => {
    const dialogCss = source('ui/src/styles/global/global-dialog-surfaces.css');
    const exportBlock = dialogCss.match(/\.mdn-app-modal-region \.export-center__card\s*\{([^}]*)\}/s)?.[1] ?? '';
    const settingsBlock = dialogCss.match(/\.mdn-app-modal-region \.settings-card--settings\s*\{([^}]*)\}/s)?.[1] ?? '';
    expect(exportBlock).toContain('min(720px');
    expect(settingsBlock).toContain('min(720px');
  });
});
