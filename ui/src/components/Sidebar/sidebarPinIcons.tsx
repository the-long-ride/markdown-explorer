interface SidebarIconProps {
  size?: number;
}

// Lucide "pin" (thumbtack) outline. Two paths: the needle stem (`M12 17v5`)
// and the head. Stroke-only — the parent's `color` (typically `var(--accent-text)`
// on `.sidebar-tree-item__pin`) drives the outline via `currentColor`.
const LUCIDE_PIN_PATHS = [
  'M12 17v5',
  'M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z',
];

export function PinIcon({ size = 13 }: SidebarIconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={LUCIDE_PIN_PATHS[0]} />
      <path d={LUCIDE_PIN_PATHS[1]} />
    </svg>
  );
}

// 24×24 Lucide thumbtack + diagonal-slash overlay. Stroke-only — inherits the
// accent color via `currentColor` from the parent button (e.g.
// `.sidebar-tree-item__pin { color: var(--accent-text); }`).
export function UnpinIcon({ size = 14 }: SidebarIconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={LUCIDE_PIN_PATHS[0]} />
      <path d={LUCIDE_PIN_PATHS[1]} />
      <path d="M3 3L18 18" />
    </svg>
  );
}

// Standalone 512×512 silhouette for the "clear all pins" toolbar action. Kept
// as a filled silhouette so it reads distinctly from the per-item stroke-only
// UnpinIcon. Preserves the three source-text contract literals asserted by
// `tests/node/sidebar-pinning-sorting.test.mjs`: `viewBox="0 0 512 512"`,
// `fill="currentColor"`, and `var(--accent, #EF4136)`.
export function ClearPinsIcon({ size = 14 }: SidebarIconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 512 512"
      shapeRendering="geometricPrecision"
      textRendering="geometricPrecision"
      imageRendering="optimizeQuality"
      fillRule="evenodd"
      clipRule="evenodd"
    >
      <path
        fill="currentColor"
        fillRule="nonzero"
        d="M364.35 65.13c-49.1-27.86-104.51-34.72-155.74-23.37.16.44.29.9.42 1.36l112.95 421.53.14.57c50.03-15.79 94.56-49.41 123.11-98.06.4-.86.86-1.68 1.38-2.46 29.79-52.2 35.77-111.59 21.33-165.51-14.44-53.87-49.29-102.28-101.17-132.62-.85-.42-1.66-.9-2.42-1.44zM237.3 301.42l-26.31-26.31-81.85 104.18 3.97 3.98 104.19-81.85zM173.73 52.57c-43.85 17.7-82.32 49.62-107.79 93.73l-.53.86C35.59 199.4 29.59 258.84 44.05 312.8c14.54 54.25 49.78 102.96 102.25 133.25l.86.54c43.85 25.04 92.79 33.27 139.3 26.71L173.73 52.57zm16.03-43.82c62.83-16.84 132.1-9.82 193.06 24.98l1.18.62c61.2 35.34 102.3 92.15 119.25 155.41 16.94 63.25 9.74 133-25.61 194.23-35.4 61.22-92.19 102.32-155.41 119.26-62.84 16.84-132.13 9.81-193.09-25l-1.14-.6C66.8 442.31 25.7 385.5 8.75 322.23c-16.84-62.84-9.82-132.12 24.99-193.08l.61-1.15C69.69 66.8 126.5 25.7 189.76 8.75z"
      />
      <path
        fill="var(--accent, #EF4136)"
        d="m380.22 204.39-73.11-73.11c-6.22-6.22-16.09.2-19.04 5.67-.5.94.38 1.79-.42 8.11-.99 7.84-2.77 16.55-5.63 23.46l-32.52 32.51c-12.98 12.99-31.54 7.22-47.37-.65-3.35-1.67-7.64-5.33-11.34-1.63l-13.77 13.77c-2.01 2.01-2.01 5.3 0 7.31l115.55 115.55c2.01 2.01 5.3 2.01 7.32 0l13.76-13.77c3.66-3.66-1.01-8.41-2.92-12.37-7.05-14.58-13.36-34.01-1.62-45.74l33.94-33.95c6.68-2.09 15.29-4.04 23.53-5.34 6.39-1 7.17-.21 8.1-.81 5.59-3.62 11.8-12.75 5.54-19.01z"
      />
    </svg>
  );
}

export function SortIcon({ size = 14 }: SidebarIconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M3 3h7M3 6h5M3 9h3" stroke="currentColor" strokeLinecap="round" />
      <path d="M11 8v5m0 0-2-2m2 2 2-2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SortNameAscIcon({ size = 13 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 485 511.82" fill="currentColor">
      <path fillRule="nonzero" d="M276.55 208.92v-29.43l14.65-2.14L353.48 0h54.5l62.41 177.35 14.61 2.14v29.43h-78.04v-29.43l13.67-2.56-6.32-22.64h-67.15l-6.02 22.64 13.62 2.56v29.43h-78.21zm-102.78-84.45H132.3v380.26c0 3.54-3.5 7.09-7.09 7.09H64.3c-3.64 0-7.18-3.17-7.18-7.09V124.47H15.69c-3.64 0-7.31-1.24-10.26-3.84-6.57-5.68-7.26-15.64-1.62-22.17L84.93 5.38c6.45-7.13 17.68-7.22 23.96.3l76.55 92.48c2.56 2.82 4.05 6.58 4.05 10.59 0 8.76-7 15.72-15.72 15.72zm184.02-5.51h45.75L383.17 55.7l-2.31-7.3h-.85l-2.44 8.03-19.78 62.53zm-57.02 392.69v-31.44l97.69-138.91h-52.71l-3.72 26.56h-37.72l2.7-65.14h154.71v30.33L363.73 473.2h62.66l4.02-24.82h37.63l-4.14 63.27H300.77z" />
    </svg>
  );
}

export function SortNameDescIcon({ size = 13 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 485 511.6" fill="currentColor">
      <path fillRule="nonzero" d="M300.83 208.85v-31.43l97.66-138.86H345.8l-3.72 26.56h-37.7L307.07 0h154.66v30.32l-97.96 140.1h62.65l4.01-24.81h37.62l-4.14 63.24H300.83zM173.71 387.21h-41.46V7.09c0-3.55-3.5-7.09-7.09-7.09H64.27c-3.63 0-7.17 3.16-7.17 7.09v380.12H15.68c-3.63 0-7.3 1.23-10.25 3.84-6.57 5.68-7.26 15.63-1.62 22.16l81.09 93.04c6.45 7.14 17.68 7.22 23.95-.29l76.52-92.45c2.56-2.82 4.06-6.58 4.06-10.59 0-8.75-7-15.71-15.72-15.71zm102.91 124.25v-29.42l14.65-2.13 62.26-177.29h54.48l62.39 177.29 14.6 2.13v29.42h-78.01v-29.42l13.66-2.56-6.32-22.63h-67.12l-6.02 22.63 13.62 2.56v29.42h-78.19zm81.22-89.92h45.73L383.2 358.3l-2.3-7.3h-.86l-2.43 8.02-19.77 62.52z" />
    </svg>
  );
}

export function SortClockIcon({ size = 13 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 512 513.11" fill="currentColor">
      <path fillRule="nonzero" d="M210.48 160.8c0-14.61 11.84-26.46 26.45-26.46s26.45 11.85 26.45 26.46v110.88l73.34 32.24c13.36 5.88 19.42 21.47 13.54 34.82-5.88 13.35-21.47 19.41-34.82 13.54l-87.8-38.6c-10.03-3.76-17.16-13.43-17.16-24.77V160.8zM5.4 168.54c-.76-2.25-1.23-4.64-1.36-7.13l-4-73.49c-.75-14.55 10.45-26.95 25-27.69 14.55-.75 26.95 10.45 27.69 25l.74 13.6a254.258 254.258 0 0136.81-38.32c17.97-15.16 38.38-28.09 61.01-38.18 64.67-28.85 134.85-28.78 196.02-5.35 60.55 23.2 112.36 69.27 141.4 132.83.77 1.38 1.42 2.84 1.94 4.36 27.86 64.06 27.53 133.33 4.37 193.81-23.2 60.55-69.27 112.36-132.83 141.39a26.24 26.24 0 01-12.89 3.35c-14.61 0-26.45-11.84-26.45-26.45 0-11.5 7.34-21.28 17.59-24.92 7.69-3.53 15.06-7.47 22.09-11.8.8-.66 1.65-1.28 2.55-1.86 11.33-7.32 22.1-15.7 31.84-25.04.64-.61 1.31-1.19 2-1.72 20.66-20.5 36.48-45.06 46.71-71.76 18.66-48.7 18.77-104.46-4.1-155.72l-.01-.03C418.65 122.16 377.13 85 328.5 66.37c-48.7-18.65-104.46-18.76-155.72 4.1a203.616 203.616 0 00-48.4 30.33c-9.86 8.32-18.8 17.46-26.75 27.29l3.45-.43c14.49-1.77 27.68 8.55 29.45 23.04 1.77 14.49-8.55 27.68-23.04 29.45l-73.06 9c-13.66 1.66-26.16-7.41-29.03-20.61zM283.49 511.5c20.88-2.34 30.84-26.93 17.46-43.16-5.71-6.93-14.39-10.34-23.29-9.42-15.56 1.75-31.13 1.72-46.68-.13-9.34-1.11-18.45 2.72-24.19 10.17-12.36 16.43-2.55 39.77 17.82 42.35 19.58 2.34 39.28 2.39 58.88.19zm-168.74-40.67c7.92 5.26 17.77 5.86 26.32 1.74 18.29-9.06 19.97-34.41 3.01-45.76-12.81-8.45-25.14-18.96-35.61-30.16-9.58-10.2-25.28-11.25-36.11-2.39a26.436 26.436 0 00-2.55 38.5c13.34 14.2 28.66 27.34 44.94 38.07zM10.93 331.97c2.92 9.44 10.72 16.32 20.41 18.18 19.54 3.63-36.01-14.84 30.13-33.82-4.66-15-7.49-30.26-8.64-45.93-1.36-18.33-20.21-29.62-37.06-22.33C5.5 252.72-.69 262.86.06 274.14c1.42 19.66 5.02 39 10.87 57.83z" />
    </svg>
  );
}

export function SortArrowUpIcon({ size = 13 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 512 421.65" fill="currentColor">
      <path fillRule="nonzero" d="M383.01 379.71c11.57 0 20.97 9.4 20.97 20.97 0 11.57-9.4 20.97-20.97 20.97l-362.04-.44C9.4 421.21 0 411.81 0 400.24c0-11.57 9.4-20.97 20.97-20.97l362.04.44zm-90.97-238.93c-7.91 7.94-20.8 7.99-28.74.08-7.94-7.91-7.99-20.8-.08-28.74L369.33 5.98c7.91-7.94 20.79-7.99 28.73-.08l107.98 107.91c7.95 7.94 7.95 20.87 0 28.81-7.94 7.95-20.87 7.95-28.81 0l-73.12-73.11.32 206.4c0 11.2-9.1 20.3-20.3 20.3-11.2 0-20.29-9.1-20.29-20.3l-.32-206.63-71.48 71.5zM171.62 40.59c11.57 0 20.97 9.41 20.97 20.98 0 11.56-9.4 20.97-20.97 20.97l-150.65-.16C9.4 82.38 0 72.97 0 61.4c0-11.56 9.4-20.97 20.97-20.97l150.65.16zm41.33 170.71c11.57 0 20.97 9.4 20.97 20.97 0 11.57-9.4 20.97-20.97 20.97l-191.98-.23C9.4 253.01 0 243.61 0 232.04c0-11.56 9.4-20.97 20.97-20.97l191.98.23z" />
    </svg>
  );
}

export function SortArrowDownIcon({ size = 13 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 512 421.65" fill="currentColor">
      <path fillRule="nonzero" d="M383.01 0c11.57 0 20.97 9.4 20.97 20.97 0 11.57-9.4 20.97-20.97 20.97l-362.04.44C9.4 42.38 0 32.97 0 21.4 0 9.84 9.4.43 20.97.43L383.01 0zM263.22 309.53c-7.91-7.95-7.86-20.83.08-28.74s20.83-7.86 28.74.08l71.48 71.5.32-206.63c0-11.2 9.09-20.3 20.29-20.3s20.3 9.1 20.3 20.3l-.32 206.4 73.12-73.12c7.94-7.94 20.87-7.94 28.81 0 7.95 7.95 7.95 20.88 0 28.82l-107.9 107.9c-8.02 7.91-20.9 7.87-28.81-.08L263.22 309.53zm-91.6 29.58c11.57 0 20.97 9.4 20.97 20.97 0 11.57-9.4 20.97-20.97 20.97l-150.65.16C9.4 381.21 0 371.81 0 360.24c0-11.56 9.4-20.97 20.97-20.97l150.65-.16zm41.33-170.7c11.57 0 20.97 9.4 20.97 20.97 0 11.57-9.4 20.97-20.97 20.97l-191.98.23C9.4 210.58 0 201.17 0 189.6c0-11.56 9.4-20.97 20.97-20.97l191.98-.22z" />
    </svg>
  );
}

export function SortStatusIcon({ mode, size = 13 }: { mode: string; size?: number }) {
  if (mode === 'name-asc') return <SortNameAscIcon size={size} />;
  if (mode === 'name-desc') return <SortNameDescIcon size={size} />;
  if (mode === 'modified-desc' || mode === 'created-desc') {
    return (
      <span className="sidebar__sort-status-icon-pair">
        <SortClockIcon size={size} />
        <SortArrowUpIcon size={size} />
      </span>
    );
  }
  if (mode === 'modified-asc' || mode === 'created-asc') {
    return (
      <span className="sidebar__sort-status-icon-pair">
        <SortClockIcon size={size} />
        <SortArrowDownIcon size={size} />
      </span>
    );
  }
  return null;
}
