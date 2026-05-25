# Interactive Features: Tables & Charts

This document outlines the javascript and styles coordinating sortable tables, frozen headers, funnel filters, and dynamic Chart.js rendering in [panel.html](file:///f:/Extensions/omg/media/panel.html).

---

## 📋 Table Enhancements & Sorting

### 1. Sticky Headers
Table headers stick to the top of the viewing area during page scrolls using CSS sticky positioning in [panel.css](file:///f:/Extensions/omg/media/panel.css):
```css
.mdn-th {
  position: sticky;
  top: -1px;
  z-index: 10;
  background: var(--bg-e);
}
```

### 2. Client-Side Sorting
Clicking on a header triggers `Table.sort(tableId, colIndex)`:
* Parses numerical cells by stripping currency symbols (`$`) and percentage signs (`%`).
* Sorts numerically if both cells contain valid floats, otherwise falls back to alphabetical `localeCompare`.
* Toggles the classes `sort-asc` and `sort-desc` on the header, updating visual sorting arrows.

---

## 🌪️ Funnel Category Filters

The renderer in [renderer.ts](file:///f:/Extensions/omg/src/markdown/renderer.ts) checks each table column using `isCategoryColumn`:
* If unique values are $\le 10$ or represent $\le 40\%$ of total rows, it is classified as a category.
* Adds a category filter button in the header `<span class="mdn-table-filter-btn" ...>`.

### Dropdown Popover Lifecycle
1. **Trigger**: Clicking the funnel button calls `Table.showFilterMenu`.
2. **Collection**: Scans all rows in the raw table and compiles a unique list of cell values for that column.
3. **Rendering**: Injects a `.mdn-filter-dropdown` popup element directly into the body.
4. **Positioning**: Automatically positions the dropdown relative to the clicked funnel button, aligning left or right to avoid clipping off-screen.
5. **Execution**: Clicking an option calls `Table.applyFilter`, storing the state in `Table.states[tableId].filters[colIndex]` and triggering `Table.runFilters(tableId)`.

---

## 📊 Table-to-Chart Switcher

### 1. Auto-Detection
During table initialization, `Table.detectChartable(tableId)` scans column types:
* If numeric columns are detected, the table is marked as chartable.
* Generates a switcher button group (`Table`, `Bar`, `Line`, `Pie`) in `.mdn-table-view-switcher`.

### 2. Chart Rendering (Chart.js)
When switching views, `Table.switchView` hides/shows the table wrapper and chart container canvas:
* **Row Slicing**: Limits rendering to the first 50 rows to protect webview performance.
* **Filter Matching**: Only plots rows that match active text search queries and category filters.
* **Palette Coordination**: Selects custom colors tailored to light/dark themes dynamically:
  ```javascript
  const isDark = currentTheme === 'dark' || (currentTheme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  ```
* **Destruction**: Destroys existing `Chart` instances via `state.chartInstance.destroy()` before building new ones to avoid memory leaks.

---

## 🎛️ Isolated HTML Sandboxing

When code blocks are tagged with the `html` language, they are rendered as isolated sandbox preview components to prevent script and styling collisions with the parent documentation viewer.

### 1. Iframe Wrapper & Resize Messaging
* **sandbox Attributes**: The sandbox iframe uses `sandbox="allow-scripts"` to lock down permissions while allowing interactive scripting.
* **Responsive Height Calculation**: An inline script inside the generated document listens to `onload`, `DOMContentLoaded`, and updates inside a `setInterval` loop. It posts a message `type: 'resize-iframe'` containing its computed `scrollHeight` up to the parent window.
* **Parent Resize Listener**: The host document catches this message in its window message listener, matches the generated iframe ID, and adjusts the height dynamically to fit the sandbox exactly without double scrollbars.
* **Theme Coordination**: When the parent theme updates, a `set-theme` message is posted down into all active sandboxed iframes so their styles re-align perfectly.

### 2. View Mode Toggle
* The HTML wrap container is managed via `UI.toggleHtmlMode` and `UI.setHtmlMode`. It toggles a `data-mode` attribute between `preview` and `code`.
* If `preview`, it hides the highlighted raw codeblock container and shows the sandbox iframe container.
* If `code`, it hides the iframe and displays the standard syntax-highlighted HTML source view.

---

## ⚛️ Stateful Custom Components (MDX)

To support component-driven design inside `.mdx` files, custom HTML elements are registered dynamically on the window object.

### 1. Built-in Interactive Components
* **`<interactive-counter>`**: Utilizes localized state to increment/decrement numerical values with elastic CSS hover scales.
* **`<confetti-button>`**: Fires a particle explosion when clicked. Generates and animates 30 dynamic colorful particle divs absolute-positioned relative to the click coordinates, auto-removing them upon completion.
* **`<interactive-tabs>`**: Integrates a Shadow DOM tab header and panel mapping slot names (e.g. `slot="Overview"`). Encapsulates structural styles inside the shadow root to prevent global css bleed.

### 2. Event Handler Translation
* Attributes containing JSX-style arrow functions (e.g. `onClick={() => console.log('hi')}`) are transpiled during the markdown inline rendering phase into standard DOM event listeners (e.g. `onclick="console.log('hi')"`).
