interface SettingsFeaturesIconProps {
  size?: number;
}

export function SettingsFeaturesIcon({ size = 14 }: SettingsFeaturesIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 6h7" />
      <path d="M17 6h3" />
      <circle cx="14" cy="6" r="2" />
      <path d="M4 12h3" />
      <path d="M13 12h7" />
      <circle cx="10" cy="12" r="2" />
      <path d="M4 18h9" />
      <path d="M19 18h1" />
      <circle cx="16" cy="18" r="2" />
    </svg>
  );
}
