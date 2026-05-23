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
