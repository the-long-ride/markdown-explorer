export interface DomSwitchButtonOptions {
  checked: boolean;
  label: string;
  disabled?: boolean;
  className?: string;
  onChange: (nextChecked: boolean, event: MouseEvent) => void;
}

export function createSwitchButtonElement(options: DomSwitchButtonOptions): HTMLButtonElement {
  const { checked, label, disabled = false, className = '', onChange } = options;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `app-switch${checked ? ' is-on' : ''}${className ? ` ${className}` : ''}`;
  button.role = 'switch';
  button.setAttribute('aria-checked', String(checked));
  button.setAttribute('aria-label', label);
  button.disabled = disabled;
  const thumb = document.createElement('span');
  thumb.className = 'app-switch__thumb';
  thumb.setAttribute('aria-hidden', 'true');
  button.appendChild(thumb);
  button.addEventListener('click', (event) => onChange(!checked, event));
  return button;
}
