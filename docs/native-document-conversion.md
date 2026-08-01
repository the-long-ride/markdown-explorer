# Native Document Conversion

Markdown Explorer converts documents locally. No document content is uploaded and the conversion path does not emit telemetry.

## Runtime matrix

| Runtime | Converter |
| --- | --- |
| Tauri | In-process Rust adapters; no Node runtime, sidecar, shell command, or external converter |
| Electron | `@the-long-ride/markdown-them` in the Electron main process |
| VS Code | `@the-long-ride/markdown-them` in the extension host |
| Chromium/web | Document conversion remains disabled because browser extensions cannot safely use the local Node/Rust filesystem adapters |

## Tauri format adapters

| Extensions | Rust implementation | Preview notes |
| --- | --- | --- |
| DOC, DOCX, XLS, XLSX, XLM, PPTX | `office_oxide` | DOC/XLS/XLM are marked `legacy-best-effort`; modern formats use normal converted-preview quality |
| PDF | `pdf-extract` | Extracted text is normalized into paragraphs; exact visual layout and images are not reconstructed |
| HTML | `html2markdown` | Tauri Markdown view uses the Rust converter; the original source remains available to the interactive HTML preview. Script, style, noscript, and template content is removed before Markdown conversion |
| RTF | `rtf-parser` | Common inline formatting is preserved; binary RTF payloads are rejected |
| ODT, ODP | Internal bounded ZIP/XML adapter using `zip` and `quick-xml` | Preserves document/page order, headings, lists, links, tables, and explicit line breaks where represented |
| ODS | `calamine` | Sheets stay in workbook order and render as deterministic GFM tables |

The converter returns normalized Markdown plus a stable quality code:

- `converted-preview`: normal local conversion.
- `legacy-best-effort`: legacy DOC/XLS/XLM conversion may omit formatting, formulas, or embedded objects.
- `conversion-failed`: the file was unreadable, unsupported by the adapter, malformed, or exceeded a safety bound.

## Safety boundaries

- Tauri never spawns Node, pnpm, npm, shell commands, or an office application.
- ODF ZIP members are bounded before parsing and overlapping archive entries are rejected.
- XML end tags are validated and unsupported entity references return a typed parse error.
- HTML active-content containers are removed before conversion.
- RTF binary payloads are rejected.
- Cache entries include source modification time, source size, Markdown, duration, and conversion quality.

## Direct dependency license audit

| Crate | Version | License | Network/telemetry behavior used by Markdown Explorer |
| --- | --- | --- | --- |
| `office_oxide` | 0.1.8 | MIT OR Apache-2.0 | Local file parsing only |
| `pdf-extract` | 0.12 | MIT | Local file parsing only |
| `html2markdown` | 0.2.0 | MIT | In-memory HTML conversion; optional tracing feature disabled |
| `rtf-parser` | 0.4.3 | MIT | In-memory parsing; default features disabled |
| `quick-xml` | 0.41 | MIT | In-memory XML parsing |
| `zip` | 8.6 | MIT | Local ZIP reads; only deflate enabled |
| `calamine` | 0.36 | MIT | Local spreadsheet reads |

Run `cargo deny check licenses` or the repository's license audit before release whenever these versions change.
