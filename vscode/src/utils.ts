// ============================================================
// markdown/utils.ts — Shared string utilities
// ============================================================

/** Escape HTML entities */
export function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Escape for use in HTML attribute single-quote context */
export function escAttr(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** Slugify a heading for use as an HTML id */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/** Generate a short random id (safe for HTML ids) */
export function shortId(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface ButtonOptions {
  id?: string;
  className?: string;
  onClick: string;
  label: string;
  tooltip?: string;
  iconHtml?: string;
  onlyIcon?: boolean;
  disabled?: boolean;
  tooltipPos?: 'above' | 'below';
}

export function renderButton(options: ButtonOptions): string {
  const idAttr = options.id ? ` id="${options.id}"` : '';
  const disabledAttr = options.disabled ? ' disabled' : '';
  const tooltipText = options.tooltip || options.label;
  
  const classes = options.className ? options.className.split(' ') : [];
  classes.push('tooltip-container');
  const classAttr = ` class="${classes.join(' ')}"`;
  
  const tooltipPosAttr = options.tooltipPos ? ` data-tooltip-pos="${options.tooltipPos}"` : '';

  const onlyIcon = options.onlyIcon !== false;
  const iconHtml = options.iconHtml ? `<span class="btn-icon">${options.iconHtml}</span>` : '';
  const labelHtml = onlyIcon ? '' : `<span class="btn-label">${options.label}</span>`;
  
  const content = onlyIcon
    ? (options.iconHtml || '')
    : `${iconHtml}${iconHtml && labelHtml ? ' ' : ''}${labelHtml}`;

  return `<button${classAttr}${idAttr} onclick="${options.onClick}"${disabledAttr}${tooltipPosAttr}>
  ${content}
  <span class="tooltip-text">${escHtml(tooltipText)}</span>
</button>`;
}

