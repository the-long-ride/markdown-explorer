---
timestamp: '2026-08-01T22:54:00+07:00'
name: Theme Catalog
topic: Valid modes, styles, custom theme model, migrations, and limits
document_type: reference
status: active
ui_spec: false
parent_docs:
- ../03-features/13-themes-custom-remix.md
related_docs:
- 03-settings-catalog.md
- 08-limits-catalog.md
source_scope:
- ui/src/themeTypes.ts
- ui/src/contexts/appStateConstants.ts
- ui/src/theme/customThemes.ts
test_scope:
- tests/node/theme-grouping-and-styles.test.mjs
- tests/unit/ui/custom-themes.test.ts
runtime_scope:
- shared
keywords:
- themes
- appearance
---

# Theme Catalog

## Theme modes

`auto`, `light`, `dark`

## Active theme styles

| Value | Category |
|---|---|
| `default` | Built-in style |
| `bento` | Built-in style |
| `vercel` | Built-in style |
| `tokyo-night` | Built-in style |
| `neon-voltage` | Built-in style |
| `raw-grid` | Built-in style |
| `pet-white-shiba` | Built-in style |
| `pet-k-ink` | Built-in style |
| `pet-cat` | Built-in style |
| `pet-hamster` | Built-in style |
| `pet-corgi` | Built-in style |

## Migrations and invalid values

| Input | Normalized output |
|---|---|
| `pet-shiba-memes` | `tokyo-night` |
| `pet-shiba` | `pet-white-shiba` |
| Unknown value, including `glass` | `default` |

## Custom theme fields

| Group | Fields |
|---|---|
| Identity | ID, name, base style, timestamps |
| Mode | Optional auto/light/dark override |
| Colors | Bounded light/dark token overrides |
| Layout | Density, radius, stroke, content padding, section gap |
| Background | None/image, Data URL, opacity, fit, position, blur |

See Limits Catalog for exact ranges.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `ui/src/themeTypes.ts` | Active behavior or contract |
| Implementation | `ui/src/contexts/appStateConstants.ts` | Active behavior or contract |
| Implementation | `ui/src/theme/customThemes.ts` | Active behavior or contract |
| Verification | `tests/node/theme-grouping-and-styles.test.mjs` | Automated expectation |
| Verification | `tests/unit/ui/custom-themes.test.ts` | Automated expectation |

---

[← Keyboard Shortcut Catalog](04-shortcut-catalog.md) · [Documentation index](../README.md) · [Supported Files and Conversion Catalog →](06-supported-files-and-conversion.md)
