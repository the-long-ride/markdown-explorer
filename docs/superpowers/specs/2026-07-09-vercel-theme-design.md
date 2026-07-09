# Vercel Theme Design

## Goal

Create a new built-in theme style called `Vercel Theme` based on Vercel's Geist Design System. The theme is designed to be minimal, high-contrast, structured around clean 1px borders, plenty of whitespace, precise typography, and a prominent blue focus state.

## Approach

### 1. Style System Expansion

Add `'vercel'` as a first-class `ThemeStyle` in the application types, constants, and theme picker components:
- [types.ts](file:///F:/my-repos/markdown-explorer/ui/src/types.ts): Update `ThemeStyle` type union.
- [appStateConstants.ts](file:///F:/my-repos/markdown-explorer/ui/src/contexts/appStateConstants.ts): Add `'vercel'` option to `THEME_STYLE_OPTIONS` and its label/description mappings.
- [ThemeStylePicker.tsx](file:///F:/my-repos/markdown-explorer/ui/src/components/Settings/ThemeStylePicker.tsx): Handle the display of `'vercel'` options card and map translations.

### 2. Multi-Language Translations

Define translations for `vercelLabel` and `vercelDesc` inside:
- [translations.ts](file:///F:/my-repos/markdown-explorer/ui/src/contexts/translations.ts) (interface type and inline English fallback)
- [translationsData.ts](file:///F:/my-repos/markdown-explorer/ui/src/contexts/translationsData.ts) (for all 9 supported languages: en, vi, fr, es, zh, no, ja, ko, ru)

### 3. Vercel Geist Tokens Definition

Add Geist light/dark/auto CSS variable overrides in [tokens-style-themes.css](file:///F:/my-repos/markdown-explorer/ui/src/styles/tokens/tokens-style-themes.css):
- Primary page background (`--bg`): `#ffffff` (light) / `#000000` (dark)
- Panel sidebar backgrounds (`--bg-s`): `#fafafa` (light) / `#0a0a0a` (dark)
- Everyday rounded radius (`--r`, `--r-md`): `6px`
- Popovers and dropdown radius (`--r-lg`): `12px`
- Shadows:
  - Raised cards (`--sh-sm`): `0 2px 2px rgba(0, 0, 0, 0.04)` (light) / `0 2px 4px rgba(0, 0, 0, 0.5)` (dark)
  - Popovers/menus (`--sh-md`): `0 1px 1px rgba(0, 0, 0, 0.02), 0 4px 8px -4px rgba(0, 0, 0, 0.04), 0 16px 24px -8px rgba(0, 0, 0, 0.06)` (light) / `0 4px 16px rgba(0, 0, 0, 0.6)` (dark)
  - Modals (`--sh-lg`): `0 1px 1px rgba(0, 0, 0, 0.02), 0 8px 16px -4px rgba(0, 0, 0, 0.04), 0 24px 32px -8px rgba(0, 0, 0, 0.06)` (light) / `0 8px 32px rgba(0, 0, 0, 0.7)` (dark)

### 4. Layout Surface Treatments

Create a new file `ui/src/styles/global/global-theme-vercel.css` mapped to `[data-theme-style="vercel"]`. Define:
- Flat look with clean borders and panels (no gradients).
- Signature Geist dual-ring focus state for all `:focus-visible` interactive elements:
  ```css
  [data-theme-style="vercel"] :focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent);
  }
  ```
- Active tree node highlights using vertical left border highlights.
- Import this stylesheet in [global.css](file:///F:/my-repos/markdown-explorer/ui/src/styles/global.css).

## Verification

- Confirm the "Vercel Theme" card is selectable in the theme picker.
- Verify color mode switching (light, dark, auto) updates the surface tokens correctly.
- Verify borders, buttons, typography and active node highlights render according to Geist guidelines.
