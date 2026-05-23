# Mandated Coding Rules for AI Agents

Every agent modifying this repository must follow these rules without exception. Failure to do so will result in runtime errors, theme failures, or oversized extension binaries.

---

## 🏗️ 1. Webview Script Hoisting Rules
* **Table Before UI**: In [panel.html](file:///f:/Extensions/omg/media/panel.html), the constructor object `Table` **MUST** remain defined before the `UI` object.
* **TDZ Warning**: Block-scoped declarations (`const`/`let`) in the webview are evaluated at parse-time. Moving `Table` below `UI` triggers a **Temporal Dead Zone (TDZ) ReferenceError** because `UI.renderContent` calls `Table` functions.

---

## 🎨 2. Theme & Visual Contrast Limits
* **Light Mode Grays**: In [panel.css](file:///f:/Extensions/omg/media/panel.css), maintain highly legible colors for light-theme variables:
  * `--tx2` (secondary text, labels) must have a contrast ratio of $\ge 4.5:1$ on light backgrounds (current: `#484854`).
  * `--txm` (metadata, placeholders, chevrons) must have a contrast ratio of $\ge 4.5:1$ on light backgrounds (current: `#666672`).
  * `--hl-cm` (code comments) must have a contrast ratio of $\ge 4.5:1$ on code blocks (current: `#5c6370`).
* **Accent Link Visibility**: Keep `--accent-text` set to `#6d5ef0` in light mode to keep links and active states readable.

---

## 🔍 3. Syntax Highlighting Overrides
* **Properties vs. Types**: Ensure properties and types are styled differently:
  * `.hljs-property` and `.hljs-attr` must use `var(--hl-attr)`.
  * `.hljs-type` and `.hljs-built_in` must use `var(--hl-prop)`.
* **Important Enforcements**: Always append `!important` to all `.hljs-` override rules in [panel.css](file:///f:/Extensions/omg/media/panel.css) to guarantee our theme is applied over default CDN styles.
* **Regex optional-properties**: Regex scanning for optional properties in [panel.html](file:///f:/Extensions/omg/media/panel.html) must account for keywords pre-highlighted by Highlight.js (e.g. `<span class="hljs-keyword">default</span>?:`). Always use the two-step regex replacement pattern to handle both wrapped and unwrapped identifiers.

---

## 🖼️ 4. Safe HTML, General Styling & Zoom
* **Safe HTML Tags List**: When parsing inline markdown syntax in [inline.ts](file:///f:/Extensions/omg/src/markdown/inline.ts), `SAFE_HTML_TAG_RE` must explicitly allow structural layout and formatting HTML tags (`img`, `p`, `div`, `span`, `a`, `h[1-6]`, `details`, `summary`, `strong`, `em`, `code`, `pre`, `hr`) to support raw embedded HTML rendering.
* **General Image Selectors**: In [panel.css](file:///f:/Extensions/omg/media/panel.css), styling rules for responsive images must target `.mdn-body img` in general (in addition to `.mdn-img` class) to ensure raw HTML `<img>` tags are styled identically.
* **General Zoom Queries**: In [panel.html](file:///f:/Extensions/omg/media/panel.html), always query `.mdn-body img` (instead of restricting to `.mdn-body img.mdn-img`) inside `getClickableMedia` and click delegation listeners so that raw HTML images are zoomable in the modal view.

---

## 🔗 5. Robust Document Navigation
* **Space Decodes**: In `_navigateTo` in [panel.ts](file:///f:/Extensions/omg/src/core/panel.ts), always decode the incoming path with `decodeURIComponent` to safely handle filenames containing space characters parsed as `%20`.
* **Dynamic Dir Resolving**: Resolve relative targets based on the current document's parent directory, falling back to the workspace root if `_currentFile` is null.
* **Disk Existence Checks**: Verify direct file system presence using `fs.existsSync` before checking cache or failing. This guarantees newly added or dynamic workspace notes open without "File not found" pages.

---

## 📦 6. Minimal VSIX Footprint
* **Resource Exclusion**: The packaged VSIX binary size **MUST** remain under **100 KB**.
* **vscodeignore Audits**: Any new development files, test scripts, or raw asset folders (like screenshots) must be appended to [.vscodeignore](file:///f:/Extensions/omg/.vscodeignore) so they are never bundled into the VSIX.
* **Keep source code out**: Never package `src/` or `test/`. Only `out/` and necessary compiled assets inside `media/` are allowed.

---

## 🧪 7. Verification Checklist
Before completing your turn, you must run:
1. `npm run compile`: Verify there are no TypeScript syntax or type compilation errors.
2. `npm run package`: Verify that the VSIX packages successfully, does not contain ignored files, and remains under **100 KB**.
