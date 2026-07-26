// =============================================================================
// components/shared/icons.tsx — SVG icon components
// =============================================================================

import type { CSSProperties } from 'react';

interface IconProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export const HomeIcon = ({ size = 13, ...rest }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 122.88 113.97" width={size} height={size} fill="currentColor" {...rest}>
    <path d="M18.69,73.37,59.18,32.86c2.14-2.14,2.41-2.23,4.63,0l40.38,40.51V114h-30V86.55a3.38,3.38,0,0,0-3.37-3.37H52.08a3.38,3.38,0,0,0-3.37,3.37V114h-30V73.37ZM60.17.88,0,57.38l14.84,7.79,42.5-42.86c3.64-3.66,3.68-3.74,7.29-.16l43.41,43,14.84-7.79L62.62.79c-1.08-1-1.24-1.13-2.45.09Z" fillRule="evenodd"/>
  </svg>
);

export const ChevronLeftIcon = ({ size = 13, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" {...rest}>
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

export const ChevronRightIcon = ({ size = 13, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" {...rest}>
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

export const ChevronUpIcon = ({ size = 16, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" {...rest}>
    <polyline points="18 15 12 9 6 15"/>
  </svg>
);

export const ExpandIcon = ({ size = 12, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...rest}>
    <polyline points="7 13 12 18 17 13"/>
    <polyline points="7 6 12 11 17 6"/>
  </svg>
);

export const CollapseIcon = ({ size = 12, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...rest}>
    <polyline points="17 11 12 6 7 11"/>
    <polyline points="17 18 12 13 7 18"/>
  </svg>
);

export const EditIcon = ({ size = 12, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...rest}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/>
  </svg>
);

export const SearchIcon = ({ size = 13, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...rest}>
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.35-4.35"/>
  </svg>
);

export const PlusIcon = ({ size = 14, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" {...rest}>
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

export const SettingsIcon = ({ size = 14, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...rest}>
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

export const SidebarIcon = ({ size = 14, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...rest}>
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <path d="M9 3v18"/>
  </svg>
);

export const RefreshIcon = ({ size = 14, ...rest }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 122.61 122.88" width={size} height={size} fill="currentColor" {...rest}>
    <path d="M111.9,61.57a5.36,5.36,0,0,1,10.71,0A61.3,61.3,0,0,1,17.54,104.48v12.35a5.36,5.36,0,0,1-10.72,0V89.31A5.36,5.36,0,0,1,12.18,84H40a5.36,5.36,0,1,1,0,10.71H23a50.6,50.6,0,0,0,88.87-33.1ZM106.6,5.36a5.36,5.36,0,1,1,10.71,0V33.14A5.36,5.36,0,0,1,112,38.49H84.44a5.36,5.36,0,1,1,0-10.71H99A50.6,50.6,0,0,0,10.71,61.57,5.36,5.36,0,1,1,0,61.57,61.31,61.31,0,0,1,91.07,8,61.83,61.83,0,0,1,106.6,20.27V5.36Z"/>
  </svg>
);

export const FolderIcon = ({ size = 12, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...rest}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
);

export const FileNotFoundIcon = ({ size = 52, ...rest }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...rest}
  >
    <path d="M16 6h22l12 12v40H16z" />
    <path d="M38 6v12h12" />
    <path d="M23 31h20" opacity=".45" />
    <text
      x="32"
      y="46"
      fill="currentColor"
      stroke="none"
      textAnchor="middle"
      fontSize="12"
      fontWeight="700"
      fontFamily="system-ui, sans-serif"
    >
      404
    </text>
  </svg>
);

export const AlertTriangleIcon = ({ size = 16, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...rest}>
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

export const TrashIcon = ({ size = 14, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...rest}>
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6 18 20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/>
    <path d="M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

export const FolderChevronIcon = ({ size = 10, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" {...rest}>
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

export const ZoomInIcon = ({ size = 18, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...rest}>
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
  </svg>
);

export const ZoomOutIcon = ({ size = 18, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...rest}>
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    <line x1="8" y1="11" x2="14" y2="11"/>
  </svg>
);

export const ResetZoomIcon = ({ size = 18, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...rest}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <polyline points="3 3 3 8 8 8"/>
  </svg>
);

export const CopyIcon = ({ size = 13, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...rest}>
    <rect x="9" y="9" width="13" height="13" rx="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);

export const CheckIcon = ({ size = 13, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" {...rest}>
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

export const SunIcon = ({ size = 14, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...rest}>
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);

export const MoonIcon = ({ size = 14, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...rest}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

export const CodeIcon = ({ size = 13, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...rest}>
    <path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/>
  </svg>
);

export const EyeIcon = ({ size = 13, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...rest}>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

export const CloseIcon = ({ size = 16, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...rest}>
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);


export const InternetIcon = ({ size = 14, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 122.88 113.6" fill="currentColor" aria-hidden="true" {...rest}>
    <path d="M71.89,100.56q-3.86,3.82-8.37,7.63c1.26-.17,2.52-.38,3.74-.62a49.38,49.38,0,0,0,7.08-2c.14.22.28.43.43.64.37.51.71.94,1,1.27l0,0,0,0a16.4,16.4,0,0,0,2.13,2,55.29,55.29,0,0,1-9.73,2.92,58.73,58.73,0,0,1-22.83,0,53.48,53.48,0,0,1-10.6-3.27.26.26,0,0,1-.14-.07A62.1,62.1,0,0,1,25,103.89,54.41,54.41,0,0,1,16.6,97a52.69,52.69,0,0,1-6.89-8.38A59.79,59.79,0,0,1,4.46,79,55.79,55.79,0,0,1,1.12,68.22a58.73,58.73,0,0,1,0-22.83A52.86,52.86,0,0,1,4.4,34.79a.33.33,0,0,1,.06-.14A60.34,60.34,0,0,1,9.71,25a54,54,0,0,1,6.89-8.39A52.19,52.19,0,0,1,25,9.71a59.7,59.7,0,0,1,9.67-5.25A54.52,54.52,0,0,1,45.39,1.12a58.73,58.73,0,0,1,22.83,0,53.89,53.89,0,0,1,10.6,3.27.28.28,0,0,1,.13.07,61.75,61.75,0,0,1,9.68,5.25A54.41,54.41,0,0,1,97,16.59,52.27,52.27,0,0,1,103.89,25a58.19,58.19,0,0,1,5.25,9.67,54.52,54.52,0,0,1,3.34,10.74l.12.6-5.42-1.53a47,47,0,0,0-2.6-7.83,54.22,54.22,0,0,0-2.87-5.76H85.08a65.47,65.47,0,0,1,4.2,8.49c-2.07-.57-4.13-1.13-6.16-1.66a65.73,65.73,0,0,0-3.86-6.83h-20v3.41l-.61.22a13.48,13.48,0,0,0-4.36,2.68V30.87h-20q-7.67,11.91-8.62,23.44H51.24q1,2.47,2.09,5H25.62c.31,7.87,3,15.67,7.88,23.44H54.32V61.56c1.59,3.63,3.27,7.29,5,11V82.73h4.76c.77,1.66,1.53,3.31,2.29,5H59.29v17.51a123.84,123.84,0,0,0,10.53-9.65q1.05,2.49,2.07,5ZM114.75,98a4.64,4.64,0,0,1-1.17.79l-.08,0a4.14,4.14,0,0,1-4.36-.6l-11.6-9.84-4,9.77a12.93,12.93,0,0,1-1.19,2.25,9.1,9.1,0,0,1-1.51,1.76,4.78,4.78,0,0,1-7.5-.82,9.28,9.28,0,0,1-.92-1.63c-6.9-17.49-16.26-34.9-23.26-52.4A3.11,3.11,0,0,1,62.65,43c16.77,3.1,38.5,10.19,55.55,14.71,5.3,1.4,6.16,6.07,2.25,9.69a12.21,12.21,0,0,1-2,1.52c-3,1.7-6,3.67-9,5.47l11.55,9.9a4.25,4.25,0,0,1,1,1.26l0,.08a4.28,4.28,0,0,1,.39,1.47v0a4.26,4.26,0,0,1-.16,1.54,4.39,4.39,0,0,1-.72,1.39A94.55,94.55,0,0,1,114.75,98Zm-3-3.84,5.59-6.56c-2.46-2.11-13-10.29-14.09-12.26a2.41,2.41,0,0,1,.83-3.25c3.66-2,8.36-4.86,11.83-7.17a8.38,8.38,0,0,0,1.22-.89,4.42,4.42,0,0,0,.75-.87l.16-.3-.31-.18a3.92,3.92,0,0,0-.76-.26L65,48.6,86.83,97.74a4.8,4.8,0,0,0,.38.7l.22.29.28-.2a4.51,4.51,0,0,0,.73-.89,7.51,7.51,0,0,0,.68-1.33c1.63-4,3.49-9.47,5.4-13.17l.23-.32a2.4,2.4,0,0,1,3.37-.27l13.64,11.57ZM50.13,108.19A105.56,105.56,0,0,1,30.87,87.71H15.16a51.5,51.5,0,0,0,12.61,12,52.81,52.81,0,0,0,8.89,4.8s.07,0,.11.07a49.13,49.13,0,0,0,9.64,3c1.23.24,2.49.45,3.75.62ZM11.89,82.73H27.7a50.6,50.6,0,0,1-7-23.44H5a55.75,55.75,0,0,0,1,7.94A48.27,48.27,0,0,0,9,77a54.16,54.16,0,0,0,2.86,5.76ZM5,54.31H20.75a54.38,54.38,0,0,1,7.77-23.44H11.89A54.16,54.16,0,0,0,9,36.63s0,.07-.07.1a49.91,49.91,0,0,0-3,9.65,51.46,51.46,0,0,0-1,7.93ZM15.13,25.9H31.72A117.72,117.72,0,0,1,50.46,5.35c-1.39.17-2.76.37-4.08.65a48.36,48.36,0,0,0-9.75,3,55.24,55.24,0,0,0-8.89,4.8,51.5,51.5,0,0,0-12.61,12v0Zm48-20.55A114.63,114.63,0,0,1,81.88,25.9h16.6a48.63,48.63,0,0,0-5-5.76,49.81,49.81,0,0,0-7.63-6.27A53.27,53.27,0,0,0,77,9.06s-.06,0-.1-.06a49.15,49.15,0,0,0-9.64-3c-1.36-.27-2.73-.48-4.09-.65v0ZM59.29,8.59V25.9H75.78A115.68,115.68,0,0,0,59.29,8.59Zm-5,96.63V87.71H37a105.67,105.67,0,0,0,17.35,17.51Zm0-79.32V8.59A116.3,116.3,0,0,0,37.82,25.9Z" />
  </svg>
);

export const OpenInBrowserIcon = InternetIcon;

export const LanguageIcon = ({ size = 16, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 122.88 92.91" fill="currentColor" aria-hidden="true" {...rest}>
    <path d="M20.15 83.63 31.63 73.4a2.89 2.89 0 0 1 1.91-.73h27.8a.92.92 0 0 0 .93-.93V65.9H68v5.84a6.71 6.71 0 0 1-6.68 6.68H34.62L19.3 92.07a2.87 2.87 0 0 1-4.9-2V78.42H6.69A6.71 6.71 0 0 1 0 71.74V28.59a6.76 6.76 0 0 1 6.69-6.68h36.66v5.75H6.69a1 1 0 0 0-.94.93v43.15a.91.91 0 0 0 .28.65 1 1 0 0 0 .66.28h10.58a2.88 2.88 0 0 1 2.88 2.88v8.08Zm.21-19.48L29.6 36.24h8.83l9.24 27.91h-7.32l-1.55-5.08h-9.65l-1.51 5.08Zm10.43-10.91h6.37L34 41.81l-3.21 11.43Zm45.84-39.89h8.7v-2.24a.69.69 0 0 1 .69-.69h4.65a.68.68 0 0 1 .68.69v2.24h9.76a.68.68 0 0 1 .68.69v4.46a.68.68 0 0 1-.68.68h-1.55a26.3 26.3 0 0 1-.91 3.88l-.02.06a26.07 26.07 0 0 1-1.74 4.15 32.34 32.34 0 0 1-2.14 3.43c-.67 1-1.41 1.9-2.2 2.83a35.78 35.78 0 0 0 3.68 3.83 41.43 41.43 0 0 0 5.09 3.74.68.68 0 0 1 .21.94l-2.39 3.73a.69.69 0 0 1-1 .2 45.88 45.88 0 0 1-5.58-4.08l-.04-.03a41.42 41.42 0 0 1-4-4.1C87.3 38.93 86.15 40 85 41l-.04.03c-1.36 1.12-2.79 2.2-4.47 3.36a.69.69 0 0 1-1-.17L77 40.53a.69.69 0 0 1 .17-1c1.66-1.14 3-2.19 4.36-3.28 1.16-1 2.28-2 3.49-3.16a44.82 44.82 0 0 1-2.77-4.45A28.84 28.84 0 0 1 80 22.9a.68.68 0 0 1 .47-.84l4.27-1.19a.68.68 0 0 1 .84.47A22.62 22.62 0 0 0 89 28.7L90.27 27a26.33 26.33 0 0 0 1.51-2.47l.02-.03A19.43 19.43 0 0 0 93 21.62a24 24 0 0 0 .66-2.44h-17a.69.69 0 0 1-.69-.68V14a.69.69 0 0 1 .69-.69Zm27 56.82L88.26 56.51H61.54a6.73 6.73 0 0 1-6.69-6.68V6.69a6.71 6.71 0 0 1 2-4.72l.2-.18A6.67 6.67 0 0 1 61.54 0h54.65a6.69 6.69 0 0 1 4.71 2l.19.2a6.69 6.69 0 0 1 1.79 4.51v43.14a6.73 6.73 0 0 1-6.69 6.68h-7.7v11.62a2.88 2.88 0 0 1-4.91 2ZM91.26 51.49l11.47 10.23v-8.08a2.88 2.88 0 0 1 2.88-2.88h10.58a.92.92 0 0 0 .65-.28.91.91 0 0 0 .29-.65V6.69a1 1 0 0 0-.22-.58l-.07-.11a1 1 0 0 0-.65-.29H61.54A.94.94 0 0 0 61 6l-.11.04a.92.92 0 0 0-.28.65v43.14a.92.92 0 0 0 .93.93h27.81a2.86 2.86 0 0 1 1.91.73Z" />
  </svg>
);

export const GlobeIcon = ({ size = 14, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...rest}>
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

export const LocateIcon = ({ size = 12, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...rest}>
    <circle cx="12" cy="12" r="10"/>
    <circle cx="12" cy="12" r="3"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
  </svg>
);

export const TocIcon = ({ size = 14, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...rest}>
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <path d="M15 3v18"/>
  </svg>
);

export const DoubleChevronLeftIcon = ({ size = 14, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...rest}>
    <polyline points="11 17 6 12 11 7" />
    <polyline points="18 17 13 12 18 7" />
  </svg>
);

export const DoubleChevronRightIcon = ({ size = 14, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...rest}>
    <polyline points="13 17 18 12 13 7" />
    <polyline points="6 17 11 12 6 7" />
  </svg>
);

export const MaximizeIcon = ({ size = 12, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...rest}>
    <path d="M15 3h6v6" />
    <path d="M9 21H3v-6" />
    <path d="M21 3l-7 7" />
    <path d="M3 21l7-7" />
  </svg>
);

export const MinimizeIcon = ({ size = 12, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...rest}>
    <path d="M4 14h6v6" />
    <path d="M20 10h-6V4" />
    <path d="M14 10l7-7" />
    <path d="M10 14l-7 7" />
  </svg>
);

export const OpenFolderLocationIcon = ({ size = 15, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 512 347.28" fill="currentColor" aria-hidden="true" {...rest}>
    <path fillRule="nonzero" d="M121.35 118.09h260.64v-31.3c.73-7.76-4.67-9.69-11.24-9.98-3.77-.18-7.97-.2-11.76-.01H208.82c-36.03 0-43.17-19.04-49.96-37.13-3.87-10.32-7.56-20.17-22.65-20.17H31.83c-6.76 0-12.33 5.57-12.33 12.33v253.04l61.44-139.95c6.5-14.82 24.13-26.83 40.41-26.83Zm280.14 0h86.05c19.11 0 29.72 16.28 21.83 34.29l.03.01-73.77 168.06c-6.5 14.83-24.14 26.83-40.41 26.83H29.03c-7.65 0-13.84-2.56-18.08-6.74C4.75 335.35 0 323.41 0 315.49V31.83C0 14.31 14.31 0 31.83 0h104.38c28.52 0 34.55 16.06 40.86 32.89 4.46 11.89 9.15 24.4 31.75 24.4 51.2 0 102.48.33 153.67.02 3.05-.03 6.18-.06 9.1.07 16.41.76 30.82 5.4 29.88 29.41l.02 31.3Zm85.97 19.05H121.27c-8.66 0-19 7.42-22.44 15.25L25.06 320.45l-.03-.01c-2.05 4.68-1.46 7.8 4.07 7.8h366.2c8.66 0 18.99-7.43 22.43-15.26l73.77-168.06c.07.03 4.09-7.78-4.04-7.78Z"/>
  </svg>
);

export const RevealFileLocationIcon = ({ size = 15, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 111.87 122.88" fill="currentColor" aria-hidden="true" {...rest}>
    <path fillRule="evenodd" d="M56.75 113.57v-38.5a9.34 9.34 0 0 1 9.31-9.3h36.5a9.34 9.34 0 0 1 9.31 9.3v38.5a9.34 9.34 0 0 1-9.31 9.31h-36.5a9.34 9.34 0 0 1-9.31-9.31Zm2.74-102.1 19.59 18.35H59.49V11.47ZM20.72 69.38a2.12 2.12 0 0 0-2 2.21 2.08 2.08 0 0 0 2 2.21H45.3v-4.42Zm0 15.83a2.12 2.12 0 0 0-2 2.21 2.08 2.08 0 0 0 2 2.21H45.3v-4.42Zm0-47.5a2.12 2.12 0 0 0-2 2.21 2.09 2.09 0 0 0 2 2.21h22.73a2.13 2.13 0 0 0 2-2.2 2.1 2.1 0 0 0-2-2.22Zm0-15.83a2.12 2.12 0 0 0-2 2.21 2.08 2.08 0 0 0 2 2.21h12.5a2.12 2.12 0 0 0 2-2.21 2.1 2.1 0 0 0-2-2.21Zm0 31.67a2.12 2.12 0 0 0-2 2.21 2.1 2.1 0 0 0 2 2.21h38.44a2.13 2.13 0 0 0 2-2.21 2.09 2.09 0 0 0-2-2.21ZM90 32.45a3.26 3.26 0 0 0-2.37-3.14L58.74 1.2A3.21 3.21 0 0 0 56.23 0H5.87A5.86 5.86 0 0 0 0 5.86v100.39a5.84 5.84 0 0 0 1.72 4.15 5.91 5.91 0 0 0 4.15 1.71h39.52v-6.55H6.55v-99h46.39v26.52a3.29 3.29 0 0 0 3.29 3.29h27.2v21.45H90V32.45Zm-7.41 49.8a2.38 2.38 0 0 1 1-2c1.61-1.08 3.2.39 4.31 1.41C91 84.5 96.74 91 98.41 92.45a2.34 2.34 0 0 1 0 3.69c-1.71 1.47-7.79 8.36-10.87 11.1-1.07 1-2.53 2.12-4 1.13a2.4 2.4 0 0 1-1-2v-5.17h-9.2a2.91 2.91 0 0 1-2.89-2.9v-8a2.9 2.9 0 0 1 2.89-2.9h9.2v-5.15Z"/>
  </svg>
);

export const MoreVerticalIcon = ({ size = 15, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...rest}>
    <circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" />
  </svg>
);

export const CloseTabIcon = ({ size = 15, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
    <rect x="3" y="4" width="18" height="16" rx="2" /><path d="m9 9 6 6m0-6-6 6" />
  </svg>
);

export const CloseRightIcon = ({ size = 15, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
    <path d="M4 6h7v12H4z" /><path d="m15 8 5 5m0-5-5 5" />
  </svg>
);

export const CloseOthersIcon = ({ size = 15, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
    <rect x="8" y="5" width="8" height="14" rx="1" /><path d="m3 8 3 3m0-3-3 3m15-3 3 3m0-3-3 3" />
  </svg>
);

export const CloseAllIcon = ({ size = 15, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 122.88 120.79" fill="currentColor" aria-hidden="true" {...rest}>
    <path d="M31.4,21.63H92.08V7.68a.54.54,0,0,0,0-.22.64.64,0,0,0-.13-.19l0,0a.64.64,0,0,0-.19-.13.59.59,0,0,0-.23,0H7.68a.51.51,0,0,0-.22,0,.85.85,0,0,0-.21.14l0,0a.78.78,0,0,0-.11.18.54.54,0,0,0,0,.22v83.8a.54.54,0,0,0,0,.22v0a.94.94,0,0,0,.12.18.74.74,0,0,0,.21.13h0a.64.64,0,0,0,.2,0H23.73V29.31A7.66,7.66,0,0,1,26,23.88l0,0a7.6,7.6,0,0,1,2.46-1.63,7.68,7.68,0,0,1,2.92-.58ZM84.07,53.07a5.14,5.14,0,1,1,7.27,7.27l-10.8,10.8,10.8,10.79a5.14,5.14,0,0,1-7.27,7.28l-10.8-10.8L62.48,89.21a5.14,5.14,0,0,1-7.27-7.28L66,71.14,55.21,60.34a5.14,5.14,0,1,1,7.27-7.27l10.79,10.8,10.8-10.8ZM99.15,21.63h16a7.77,7.77,0,0,1,2.93.58,7.89,7.89,0,0,1,2.5,1.67l0,0a7.68,7.68,0,0,1,2.22,5.39v83.8a7.69,7.69,0,0,1-4.75,7.09,7.59,7.59,0,0,1-2.93.59H31.4a7.5,7.5,0,0,1-2.92-.59A7.7,7.7,0,0,1,24.31,116a7.5,7.5,0,0,1-.58-2.92v-14h-16a7.59,7.59,0,0,1-2.93-.59A7.66,7.66,0,0,1,0,91.48V7.68A7.77,7.77,0,0,1,.58,4.75a7.89,7.89,0,0,1,1.67-2.5A7.86,7.86,0,0,1,4.75.59,7.59,7.59,0,0,1,7.68,0H91.47A7.69,7.69,0,0,1,94.4.58a8.06,8.06,0,0,1,2.5,1.67,7.69,7.69,0,0,1,2.25,5.43v14Zm16,7.07H31.4a.5.5,0,0,0-.21.05.6.6,0,0,0-.21.14h0a.86.86,0,0,0-.13.2.51.51,0,0,0,0,.22v83.8a.54.54,0,0,0,0,.22.66.66,0,0,0,.14.2l0,0a.71.71,0,0,0,.18.12.85.85,0,0,0,.22,0h83.8a.78.78,0,0,0,.22,0h0a.75.75,0,0,0,.18-.13.8.8,0,0,0,.13-.19v0a.64.64,0,0,0,0-.2V29.31a.54.54,0,0,0,0-.22v0a.66.66,0,0,0-.12-.17.85.85,0,0,0-.21-.14.54.54,0,0,0-.22-.05Z" />
  </svg>
);

export const HtmlPreviewIcon = ({ size = 15, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" />
  </svg>
);

export const MarkdownViewIcon = ({ size = 15, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
    <path d="M4 5h16v14H4z" /><path d="M7 15V9l3 3 3-3v6m2-3 2 2 2-2" />
  </svg>
);

export const ImportSettingsIcon = ({ size = 16, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 512 437.242" fill="currentColor" aria-hidden="true" {...rest}>
    <path fillRule="nonzero" d="M.723 313.756c-2.482-10.26 1.698-18.299 8.38-23.044a23.417 23.417 0 0 1 8.018-3.632c2.877-.7 5.88-.865 8.764-.452 8.127 1.166 15.534 6.417 18.013 16.677a632.525 632.525 0 0 1 4.317 19.091c1.566 7.418 2.52 12.234 3.418 16.772 4.445 22.443 7.732 36.512 16.021 43.526 8.775 7.423 25.366 9.985 57.167 9.985h268.042c29.359 0 44.674-2.807 52.736-10.093 7.768-7.023 10.805-20.735 14.735-41.777l.007-.043a1038.93 1038.93 0 0 1 3.426-17.758c1.298-6.427 2.722-13.029 4.34-19.703 2.484-10.256 9.886-15.503 18.008-16.677 2.861-.41 5.846-.242 8.722.449 2.905.699 5.679 1.935 8.068 3.633 6.672 4.741 10.843 12.762 8.38 22.997l-.011.044a494.136 494.136 0 0 0-3.958 17.974c-1.011 5.023-2.169 11.215-3.281 17.178l-.008.043c-5.792 31.052-10.544 52.357-26.462 67.319-15.681 14.741-40.245 20.977-84.699 20.977H124.823c-46.477 0-72.016-5.596-88.445-20.144-16.834-14.909-21.937-36.555-28.444-69.403-1.316-6.654-2.582-13.005-3.444-17.126-1.213-5.781-2.461-11.434-3.767-16.813zm165.549-143.439 65.092 68.466.204-160.91h47.595l-.204 160.791 66.774-70.174 34.53 32.848-125.184 131.556-123.336-129.729 34.529-32.848zm65.325-115.413.028-22.041h47.594l-.028 22.041h-47.594zm.046-36.254L231.666 0h47.595l-.024 18.65h-47.594z"/>
  </svg>
);

export const ExportSettingsIcon = ({ size = 16, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 512 444.019" fill="currentColor" aria-hidden="true" {...rest}>
    <path fillRule="nonzero" d="M.723 320.533c-2.482-10.26 1.698-18.299 8.38-23.044a23.417 23.417 0 0 1 8.018-3.632c2.877-.699 5.88-.864 8.764-.452 8.127 1.166 15.534 6.417 18.013 16.677a631.854 631.854 0 0 1 4.317 19.092 1205.66 1205.66 0 0 1 3.418 16.772c4.445 22.442 7.732 36.511 16.021 43.526 8.775 7.422 25.366 9.984 57.167 9.984h268.042c29.359 0 44.674-2.807 52.736-10.093 7.768-7.022 10.805-20.735 14.735-41.777l.007-.043c.916-4.946 1.889-10.139 3.426-17.758 1.298-6.427 2.722-13.029 4.34-19.703 2.484-10.255 9.886-15.503 18.008-16.677 2.861-.41 5.846-.242 8.722.449 2.905.699 5.679 1.935 8.068 3.633 6.672 4.742 10.843 12.763 8.38 22.997l-.011.044a493.707 493.707 0 0 0-3.958 17.975c-1.011 5.023-2.169 11.215-3.281 17.177l-.008.044c-5.792 31.052-10.544 52.357-26.462 67.318-15.681 14.742-40.245 20.977-84.699 20.977H124.823c-46.477 0-72.016-5.596-88.445-20.144-16.834-14.909-21.937-36.555-28.444-69.403-1.316-6.653-2.582-13.005-3.444-17.125-1.213-5.782-2.461-11.434-3.767-16.814zm131.02-190.804L255.079 0l125.184 131.556-34.53 32.848-66.774-70.174.201 158.278h-47.594l-.202-158.397-65.092 68.466-34.529-32.848zM279.191 276.45l.028 22.977h-47.594l-.028-22.977h47.594zm.046 37.794.024 18.65h-47.595l-.023-18.65h47.594z"/>
  </svg>
);
