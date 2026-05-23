# Styling & Contrast Themes

This document describes the design system and syntax highlighting themes configured in [panel.css](file:///f:/Extensions/omg/media/panel.css).

---

## 🎨 Theme Colors & CSS Variables

The extension supports `dark`, `light`, and `auto` (media preferences matching) themes. 

### 1. Light Theme Tokens
* **`--bg`**: `#f7f6f3` (main content background)
* **`--bg-s`**: `#faf9f6` (sidebar background)
* **`--bg-code`**: `#f0ede8` (code block background)
* **`--tx`**: `#1c1c20` (high-contrast body text)
* **`--tx2`**: `#484854` (secondary text, labels; contrast $\ge 5.5:1$ on `--bg`)
* **`--txm`**: `#666672` (metadata, placeholders, chevrons; contrast $\ge 4.5:1$ on `--bg`)
* **`--accent-text`**: `#6d5ef0` (premium dark purple; contrast $\ge 4.5:1$)

### 2. Dark Theme Tokens
* **`--bg`**: `#1a1a1e`
* **`--bg-s`**: `#222228`
* **`--bg-code`**: `#17171c`
* **`--tx`**: `#e2e2e8`
* **`--tx2`**: `#9191a4`
* **`--txm`**: `#56566a`
* **`--accent-text`**: `#a99ef9`

---

## 🔍 Code block Syntax Highlighting Overrides

Highlight.js rules are overridden in `panel.css` to match native VS Code coloring standards. **Important: All overrides must append `!important` to prevent them from being overridden by dynamic CDN themes.**

### Token to Variable Mapping

```mermaid
graph TD
    classDef kw fill:#f9f,stroke:#333,stroke-width:2px;
    classDef str fill:#ccf,stroke:#333,stroke-width:2px;
    classDef attr fill:#cfc,stroke:#333,stroke-width:2px;
    classDef prop fill:#ffc,stroke:#333,stroke-width:2px;

    hljs-keyword(hljs-keyword) -->|kw| hl-kw(--hl-kw)
    hljs-doctag(hljs-doctag) -->|kw| hl-kw
    
    hljs-string(hljs-string) -->|str| hl-str(--hl-str)
    hljs-link(hljs-link) -->|str| hl-str
    
    hljs-attr(hljs-attr) -->|attr| hl-attr(--hl-attr)
    hljs-property(hljs-property) -->|attr| hl-attr
    
    hljs-type(hljs-type) -->|prop| hl-prop(--hl-prop)
    hljs-built_in(hljs-built_in) -->|prop| hl-prop
```

### Key Highlighting Classes
* **`.hljs-keyword`**: Uses `var(--hl-kw)` (pink/red, bold).
* **`.hljs-string`**: Uses `var(--hl-str)` (dark blue in light mode, light green in dark mode).
* **`.hljs-comment`**: Uses `var(--hl-cm)` (dark gray `#5c6370` in light mode, italic).
* **`.hljs-attr` & `.hljs-property`**: Uses `var(--hl-attr)` (purple in light mode). Renders object properties and fields.
* **`.hljs-type` & `.hljs-built_in`**: Uses `var(--hl-prop)` (orange in light mode). Renders TS types and built-in keywords like `number`, `string`.
* **`.hljs-subst`**: Uses `var(--tx)`. Renders template string variables in high-contrast dark text in light mode instead of a faint gray.

---

## ⚡ Nullable Properties Highlighting (Post-Processor)
Since Highlight.js's default TS grammar does not highlight property keys with an optional question mark (e.g. `email?: string;`), we run a regex replace in `panel.html` after highlighting to scan the HTML:

1. **Keyword-wrapped Property Matcher**:
   ```javascript
   html = html.replace(/(<span class="hljs-[^"]+">)([a-zA-Z_$][\w$]*)(<\/span>\?\s*:)/g, '<span class="hljs-attr">$2?</span>:');
   ```
   Matches properties whose names match Javascript keywords (like `default?:`), unwraps the keyword tag and wraps it as `hljs-attr`.
2. **Standard Property Matcher**:
   ```javascript
   html = html.replace(/\b([a-zA-Z_$][\w$]*)\?\s*:/g, '<span class="hljs-attr">$1?</span>:');
   ```
   Wraps optional plain properties (like `email?:`) in `hljs-attr`.
