interface SidebarIconProps {
  size?: number;
  useAccentColor?: boolean;
  pinColor?: string;
}

const PUSH_PIN_PATH = 'M121.59,36.81,86.3,1.52c-3-3-7.77.09-9.2,2.74-.24.45.19.86-.2,3.91a46.16,46.16,0,0,1-2.72,11.32l-15.7,15.7c-6.26,6.27-15.22,3.48-22.87-.32-1.61-.8-3.68-2.57-5.47-.78l-6.65,6.65a2.5,2.5,0,0,0,0,3.53l55.79,55.78a2.5,2.5,0,0,0,3.53,0l6.64-6.65c1.77-1.77-.49-4.06-1.41-6-3.4-7-6.45-16.42-.78-22.09L103.65,49A84.08,84.08,0,0,1,115,46.38c3.09-.49,3.47-.1,3.91-.39,2.7-1.75,5.7-6.16,2.68-9.18ZM53.86,82.39,41.15,69.69.38,121.25l1.92,1.91L53.86,82.39Z';

export function PinIcon({ size = 13 }: SidebarIconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 123.14 123.54"
      fill="currentColor"
    >
      <path fill="currentColor" fillRule="evenodd" d={PUSH_PIN_PATH} />
    </svg>
  );
}

export function UnpinIcon({ size = 14, useAccentColor = true, pinColor }: SidebarIconProps) {
  const accentFill = pinColor ?? (useAccentColor ? 'var(--accent, #EF4136)' : '#EF4136');
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
        fill={accentFill}
        d="m380.22 204.39-73.11-73.11c-6.22-6.22-16.09.2-19.04 5.67-.5.94.38 1.79-.42 8.11-.99 7.84-2.77 16.55-5.63 23.46l-32.52 32.51c-12.98 12.99-31.54 7.22-47.37-.65-3.35-1.67-7.64-5.33-11.34-1.63l-13.77 13.77c-2.01 2.01-2.01 5.3 0 7.31l115.55 115.55c2.01 2.01 5.3 2.01 7.32 0l13.76-13.77c3.66-3.66-1.01-8.41-2.92-12.37-7.05-14.58-13.36-34.01-1.62-45.74l33.94-33.95c6.68-2.09 15.29-4.04 23.53-5.34 6.39-1 7.17-.21 8.1-.81 5.59-3.62 11.8-12.75 5.54-19.01z"
      />
      <path
        fill="currentColor"
        fillRule="nonzero"
        d="M364.35 65.13c-49.1-27.86-104.51-34.72-155.74-23.37.16.44.29.9.42 1.36l112.95 421.53.14.57c50.03-15.79 94.56-49.41 123.11-98.06.4-.86.86-1.68 1.38-2.46 29.79-52.2 35.77-111.59 21.33-165.51-14.44-53.87-49.29-102.28-101.17-132.62-.85-.42-1.66-.9-2.42-1.44zM237.3 301.42l-26.31-26.31-81.85 104.18 3.97 3.98 104.19-81.85zM173.73 52.57c-43.85 17.7-82.32 49.62-107.79 93.73l-.53.86C35.59 199.4 29.59 258.84 44.05 312.8c14.54 54.25 49.78 102.96 102.25 133.25l.86.54c43.85 25.04 92.79 33.27 139.3 26.71L173.73 52.57zm16.03-43.82c62.83-16.84 132.1-9.82 193.06 24.98l1.18.62c61.2 35.34 102.3 92.15 119.25 155.41 16.94 63.25 9.74 133-25.61 194.23-35.4 61.22-92.19 102.32-155.41 119.26-62.84 16.84-132.13 9.81-193.09-25l-1.14-.6C66.8 442.31 25.7 385.5 8.75 322.23c-16.84-62.84-9.82-132.12 24.99-193.08l.61-1.15C69.69 66.8 126.5 25.7 189.76 8.75z"
      />
    </svg>
  );
}

export function ClearPinsIcon({ size = 14 }: SidebarIconProps) {
  return <UnpinIcon size={size} />;
}

export function SortIcon({ size = 14 }: SidebarIconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M3 3h7M3 6h5M3 9h3" stroke="currentColor" strokeLinecap="round" />
      <path d="M11 8v5m0 0-2-2m2 2 2-2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
