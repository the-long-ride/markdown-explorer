interface HistoryIconProps { size?: number; }

// Visual reference: SVG Repo Eye Viewed, CC0
// https://www.svgrepo.com/svg/421552/eye-viewed
export function HistoryViewIcon({ size = 15 }: HistoryIconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></svg>;
}

// Visual reference: SVG Repo Git Compare, CC0
// https://www.svgrepo.com/svg/509960/git-compare
export function HistoryCompareIcon({ size = 15 }: HistoryIconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="6" cy="5" r="2"/><circle cx="18" cy="19" r="2"/><path d="M6 7v10a2 2 0 0 0 2 2h8"/><path d="M18 17V7a2 2 0 0 0-2-2H8"/></svg>;
}

// Visual reference: SVG Repo Clipboard Copy, CC0
// https://www.svgrepo.com/svg/446984/clipboard-copy
export function HistoryWorkingCopyIcon({ size = 15 }: HistoryIconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="8" y="8" width="11" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2"/><path d="M11 12h5M11 16h5"/></svg>;
}

export function HistoryCloseIcon({ size = 14 }: HistoryIconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>;
}
