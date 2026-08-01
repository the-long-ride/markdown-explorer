---
timestamp: '2026-08-01T22:54:00+07:00'
name: Supported Files and Conversion Catalog
topic: Base document, media, HTML, and convertible extension support
document_type: reference
status: active
ui_spec: false
parent_docs:
- ../03-features/16-document-conversion.md
related_docs:
- 08-limits-catalog.md
- ../04-runtimes/01-electron-desktop.md
- ../04-runtimes/02-tauri-desktop.md
source_scope:
- tauri/src/workspace/file_types.rs
- electron/workspace/scanner.js
- electron/render/document-converter.js
- ui/src/markdown/mediaUrls.ts
test_scope:
- tests/node/document-conversion-variants.test.mjs
- tests/unit/electron/scanner.test.ts
- tests/node/tauri-native-document-converter.test.mjs
runtime_scope:
- shared
keywords:
- files
- extensions
- conversion
---

# Supported Files and Conversion Catalog

## Base documents

| Runtime | Base file support |
|---|---|
| Shared/Electron/VS Code | Markdown and MDX; text paths where host permits |
| Tauri | `.md`, `.mdx`, `.markdown`, `.txt` plus opt-in conversion |
| Chromium scanner | Markdown/MDX browser handles |
| Website | Virtual/browser Markdown-oriented files |

## Convertible documents

`.doc`, `.docx`, `.pdf`, `.html`, `.xls`, `.xlsx`, `.xlm`, `.pptx`, `.odt`, `.odp`, `.ods`, `.rtf`

Conversion is opt-in and unavailable in Chromium. Converted previews carry quality metadata.

## Local video extensions

`.mp4`, `.m4v`, `.webm`, `.ogv`, `.ogg`, `.mov`, `.mkv`, `.m3u8`

## Image/custom-theme background MIME

Custom theme backgrounds accept image PNG, JPEG, WebP, or GIF Data URLs within limits. Document image resolution follows runtime local-media and safe URL rules.

## Ignore behavior

Electron ignores known dependency/build/cache directories and exact entries from root `.markdown-explorer-ignore`. Host-specific exclude configuration may add rules; it must not silently broaden supported binary parsing.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `tauri/src/workspace/file_types.rs` | Active behavior or contract |
| Implementation | `electron/workspace/scanner.js` | Active behavior or contract |
| Implementation | `electron/render/document-converter.js` | Active behavior or contract |
| Implementation | `ui/src/markdown/mediaUrls.ts` | Active behavior or contract |
| Verification | `tests/node/document-conversion-variants.test.mjs` | Automated expectation |
| Verification | `tests/unit/electron/scanner.test.ts` | Automated expectation |
| Verification | `tests/node/tauri-native-document-converter.test.mjs` | Automated expectation |

---

[← Theme Catalog](05-theme-catalog.md) · [Documentation index](../README.md) · [Storage Catalog →](07-storage-catalog.md)
