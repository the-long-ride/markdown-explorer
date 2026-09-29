import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { parseShortcutText } from '../shared/parseShortcutText';

export type FeatureControlIds = {
  controlId: string;
  titleId: string;
  descriptionId: string;
};

type FeatureSettingRowProps = {
  id: string;
  title: string;
  description: string;
  children: (ids: FeatureControlIds) => ReactNode;
};

const ATTENTION_MS = 1600;

/**
 * One Features setting: title and muted description on the left, control on the right.
 * The control is labelled by the title and described by the description.
 */
export function FeatureSettingRow({ id, title, description, children }: FeatureSettingRowProps) {
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
      data-row-id={id}
      className={`settings-feature-row${attention ? ' is-attention' : ''}`}
    >
      <div className="settings-feature-row__text">
        <label id={ids.titleId} htmlFor={ids.controlId} className="settings-feature-row__title">
          {title}
        </label>
        <p id={ids.descriptionId} className="settings-feature-row__desc">
          {parseShortcutText(description)}
        </p>
      </div>
      <div className="settings-feature-row__control">{children(ids)}</div>
    </div>
  );
}

type FeatureSwitchProps = {
  ids: FeatureControlIds;
  checked: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

export function FeatureSwitch({ ids, checked, onChange }: FeatureSwitchProps) {
  return (
    <label className="switch-toggle">
      <input
        id={ids.controlId}
        type="checkbox"
        checked={checked}
        aria-labelledby={ids.titleId}
        aria-describedby={ids.descriptionId}
        onChange={onChange}
      />
      <span className="switch-slider" aria-hidden="true" />
    </label>
  );
}
