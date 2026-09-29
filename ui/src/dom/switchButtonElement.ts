export interface DomSwitchButtonOptions {
  checked: boolean;
  label: string;
  disabled?: boolean;
  className?: string;
  tooltip?: string;
  tooltipPos?: 'above' | 'below';
  tooltipAlign?: 'center' | 'left' | 'right';
  onChange: (nextChecked: boolean, event: MouseEvent) => void;
}

export function createSwitchButtonElement(options: DomSwitchButtonOptions): HTMLButtonElement {
  const { checked, label, disabled = false, className = '', tooltip, tooltipPos = 'below', tooltipAlign = 'center', onChange } = options;
  const button = document.createElement('button');
  button.type = 'button';
  const classes = `app-switch${checked ? ' is-on' : ''}${className ? ` ${className}` : ''}${tooltip ? ' tooltip-container' : ''}`;
  button.className = classes;
  button.role = 'switch';
  button.setAttribute('aria-checked', String(checked));
  button.setAttribute('aria-label', label);
  if (tooltip) {
    button.setAttribute('data-tooltip-pos', tooltipPos);
    if (tooltipAlign !== 'center') {
      button.setAttribute('data-tooltip-align', tooltipAlign);
    }
  }
  button.disabled = disabled;
  const thumb = document.createElement('span');
  thumb.className = 'app-switch__thumb';
  thumb.setAttribute('aria-hidden', 'true');
  button.appendChild(thumb);
  if (tooltip) {
    const tooltipSpan = document.createElement('span');
    tooltipSpan.className = 'tooltip-text';
    tooltipSpan.textContent = tooltip;
    button.appendChild(tooltipSpan);
  }
  button.addEventListener('click', (event) => onChange(!checked, event));
  return button;
}
