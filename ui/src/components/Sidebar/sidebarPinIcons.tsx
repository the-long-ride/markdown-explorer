interface SidebarIconProps {
  size?: number;
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

export function ClearPinsIcon({ size = 14 }: SidebarIconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 123.14 123.54"
      fill="currentColor"
    >
      <path fill="currentColor" fillRule="evenodd" d={PUSH_PIN_PATH} />
      <g
        className="sidebar-pin-clear-icon__x"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="14"
      >
        <path d="M25 25l64 64" />
        <path d="M89 25L25 89" />
      </g>
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
