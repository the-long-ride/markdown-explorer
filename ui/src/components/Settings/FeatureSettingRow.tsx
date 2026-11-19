import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { parseShortcutText } from '../shared/parseShortcutText';
import { FeatureRowIcon } from './settingsRowIcons';

export type FeatureControlIds = {
  controlId: string;
  titleId: string;
  descriptionId: string;
};

type FeatureSettingRowProps = {
  id: string;
  title: string;
  description: string;
  icon?: ReactNode;
  children: (ids: FeatureControlIds) => ReactNode;
};

const ATTENTION_MS = 1600;

/**
 * One Features setting: title and muted description on the left, control on the right.
 * The control is labelled by the title and described by the description.
 */
export function FeatureSettingRow({ id, title, description, icon, children }: FeatureSettingRowProps) {
  const rowIcon = icon !== undefined ? icon : <FeatureRowIcon id={id} />;
  const rowRef = useRef<HTMLDivElement>(null);
  const [attention, setAttention] = useState(false);
  const ids: FeatureControlIds = {
    controlId: `feature-setting-${id}`,
    titleId: `feature-setting-${id}-title`,
    descriptionId: `feature-setting-${id}-description`,
  };

  useEffect(() => {
    if (id !== 'bookmarks-enabled') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const focusBookmarkSetting = () => {
      const row = rowRef.current;
      if (!row) return;
      row.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      row.querySelector<HTMLElement>('input')?.focus({ preventScroll: true });
      setAttention(true);
      clearTimeout(timer);
      timer = setTimeout(() => setAttention(false), ATTENTION_MS);
    };
    window.addEventListener('focus-bookmark-setting', focusBookmarkSetting);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus-bookmark-setting', focusBookmarkSetting);
    };
  }, [id]);

  return (
    <div
      ref={rowRef}
      id={id}
      data-row-id={id}
      className={`settings-feature-row${attention ? ' is-attention' : ''}`}
    >
      <div className="settings-feature-row__content">
        {rowIcon && <span className="settings-item__icon settings-feature-row__icon" aria-hidden="true">{rowIcon}</span>}
        <div className="settings-feature-row__text">
          <label id={ids.titleId} htmlFor={ids.controlId} className="settings-feature-row__title">
            {title}
          </label>
          <p id={ids.descriptionId} className="settings-feature-row__desc">
            {parseShortcutText(description)}
          </p>
        </div>
      </div>
      <div className="settings-feature-row__control">{children(ids)}</div>
    </div>
  );
}

type FeatureSwitchProps = {
  ids: FeatureControlIds;
  checked: boolean;
  disabled?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

export function FeatureSwitch({ ids, checked, disabled, onChange }: FeatureSwitchProps) {
  return (
    <label className={`switch-toggle${disabled ? ' is-disabled' : ''}`}>
      <input
        id={ids.controlId}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-disabled={disabled ? 'true' : undefined}
        aria-labelledby={ids.titleId}
        aria-describedby={ids.descriptionId}
        onChange={onChange}
      />
      <span className="switch-slider" aria-hidden="true" />
    </label>
  );
}
