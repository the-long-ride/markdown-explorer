export function formatLastOpened(timestamp?: number, locale = 'en') {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'narrow' });
  if (diffMins < 1) return relative.format(0, 'second');
  if (diffMins < 60) return relative.format(-diffMins, 'minute');
  if (diffHours < 24) return relative.format(-diffHours, 'hour');
  if (diffDays < 7) return relative.format(-diffDays, 'day');

  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function isDesktopRuntime() {
  return typeof (window as any).electronAPI !== 'undefined';
}


