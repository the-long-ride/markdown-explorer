interface BookmarkIconProps {
  size?: number;
  className?: string;
}

export function BookmarkIcon({ size = 14, className }: BookmarkIconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 367 511.499" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M52.353 0h249.874C337.802 0 367 29.198 367 64.776v431.621c0 12.92-15.054 19.684-24.765 11.601L183.4 384.381 24.368 508.254C14.783 515.736.44 509.262.06 496.865l-.06-.468V52.353C0 23.543 23.543 0 52.353 0zM52.353 15.106h249.874c27.324 0 49.669 22.411 49.669 49.669v431.623L183.435 365.279 15.107 496.398V52.352c0-20.489 16.757-37.246 37.246-37.246z" />
    </svg>
  );
}

export function EditBookmarkIcon({ size = 14, className }: BookmarkIconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 117.74 122.88" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M94.62 2c-1.46-1.36-3.14-2.09-5.02-1.99-1.88 0-3.56.73-4.92 2.2L73.59 13.72l31.07 30.03 11.19-11.72c1.36-1.36 1.88-3.14 1.88-5.02s-.73-3.66-2.09-4.92L94.62 2zM41.44 109.58c-4.08 1.36-8.26 2.62-12.35 3.98-4.08 1.36-8.16 2.72-12.35 4.08-9.73 3.14-15.07 4.92-16.22 5.23-1.15.31-.42-4.18 1.99-13.6l7.74-29.61.64-.66 30.56 30.56zM22.2 67.25l42.99-44.82 31.07 29.92L52.75 97.8 22.2 67.25z" />
    </svg>
  );
}

export function AddBookmarkIcon({ size = 14, className }: BookmarkIconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 91.5 122.88" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M62.42,0A29.08,29.08,0,1,1,33.34,29.08,29.08,29.08,0,0,1,62.42,0ZM3.18,19.65H24.73a38,38,0,0,0-1,6.36H6.35v86.75L37.11,86.12a3.19,3.19,0,0,1,4.18,0l31,26.69V66.68a39.26,39.26,0,0,0,6.35-2.27V119.7a3.17,3.17,0,0,1-5.42,2.24l-34-29.26-34,29.42a3.17,3.17,0,0,1-4.47-.33A3.11,3.11,0,0,1,0,119.7H0V22.83a3.18,3.18,0,0,1,3.18-3.18Zm55-2.79a4.1,4.1,0,0,1,.32-1.64l0-.06a4.33,4.33,0,0,1,3.9-2.59h0a4.23,4.23,0,0,1,1.63.32,4.3,4.3,0,0,1,1.39.93,4.15,4.15,0,0,1,.93,1.38l0,.07a4.23,4.23,0,0,1,.3,1.55v8.6h8.57a4.3,4.3,0,0,1,3,1.26,4.23,4.23,0,0,1,.92,1.38l0,.07a4.4,4.4,0,0,1,.31,1.49v.18a4.37,4.37,0,0,1-.32,1.55,4.45,4.45,0,0,1-.93,1.4,4.39,4.39,0,0,1-1.38.92l-.08,0a4.14,4.14,0,0,1-1.54.3H66.71v8.57a4.35,4.35,0,0,1-1.25,3l-.09.08a4.52,4.52,0,0,1-1.29.85l-.08,0a4.36,4.36,0,0,1-1.54.31h0a4.48,4.48,0,0,1-1.64-.32,4.3,4.3,0,0,1-1.39-.93,4.12,4.12,0,0,1-.92-1.38,4.3,4.3,0,0,1-.34-1.62V34H49.56a4.28,4.28,0,0,1-1.64-.32l-.07,0a4.32,4.32,0,0,1-2.25-2.28l0-.08a4.58,4.58,0,0,1-.3-1.54v0a4.39,4.39,0,0,1,.33-1.63,4.3,4.3,0,0,1,3.93-2.66h8.61V16.86Z" />
    </svg>
  );
}

export function RemoveBookmarkIcon({ size = 14, className }: BookmarkIconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 91.5 122.88" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M62.42,0A29.08,29.08,0,1,1,33.34,29.08,29.08,29.08,0,0,1,62.42,0ZM3.18,19.65H24.73a38,38,0,0,0-1,6.36H6.35v86.75L37.11,86.12a3.19,3.19,0,0,1,4.18,0l31,26.69V66.68a39.26,39.26,0,0,0,6.35-2.27V119.7a3.17,3.17,0,0,1-5.42,2.24l-34-29.26-34,29.42a3.17,3.17,0,0,1-4.47-.33A3.11,3.11,0,0,1,0,119.7H0V22.83a3.18,3.18,0,0,1,3.18-3.18Zm72.1,5.77a4.3,4.3,0,0,1,3,1.26,4.23,4.23,0,0,1,.92,1.38l0,.07a4.4,4.4,0,0,1,.31,1.49v.18a4.37,4.37,0,0,1-.32,1.55,4.45,4.45,0,0,1-.93,1.4,4.39,4.39,0,0,1-1.38.92l-.08,0a4.14,4.14,0,0,1-1.54.3H49.56a4.28,4.28,0,0,1-1.64-.32l-.07,0a4.32,4.32,0,0,1-2.25-2.28l0-.08a4.58,4.58,0,0,1-.3-1.54v0a4.39,4.39,0,0,1,.33-1.63,4.3,4.3,0,0,1,3.93-2.66Z" />
    </svg>
  );
}

export function SelectionModeIcon({ size = 14, className }: BookmarkIconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 122.47 122.88" fill="currentColor" aria-hidden="true">
      <path d="M12.21 98.7v11.97h12.66v12.21H6.1c-3.37 0-6.1-2.73-6.1-6.1V98.7h12.21zM27.89 20.54h67.64c3.37 0 6.1 2.73 6.1 6.1v69.73c0 3.37-2.73 6.1-6.1 6.1H27.89c-3.37 0-6.1-2.73-6.1-6.1V26.64c0-3.37 2.73-6.1 6.1-6.1zm63.45 10.28H32.07v61.36h59.27V30.82zM0 24.18V6.1C0 2.73 2.73 0 6.1 0h18.76v12.21H12.21v11.97H0zm110.27 0V12.21H97.61V0h18.76c3.37 0 6.1 2.73 6.1 6.1v18.07h-12.2zM122.47 98.7v18.07c0 3.37-2.73 6.1-6.1 6.1H97.61v-12.21h12.66V98.7h12.2z" />
    </svg>
  );
}

export function SelectAllIcon({ size = 14, className }: BookmarkIconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

export function BookmarkGroupChevron({ expanded, size = 12 }: { expanded: boolean; size?: number }) {
  return (
    <svg className={`bookmark-group__chevron${expanded ? ' is-expanded' : ''}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
