import { useMemo, useState } from 'react';
import { getUserManualTranslations, type UserManualAction } from '../../contexts/userManualTranslations';
import type { AppSettings } from '../../types';
import { formatShortcutLabel, getEnabledShortcut } from '../../utils/shortcuts';
import { BookmarkIcon } from '../Bookmarks/BookmarkIcons';
import { FolderIcon, SearchIcon, SettingsIcon } from './WelcomePageIcons';
import './UserManualTab.css';

interface UserManualTabProps {
  language: string;
  settings: AppSettings;
}

const ACTION_EVENTS: Record<UserManualAction, string> = {
  workspace: 'open-workspace-selection',
  search: 'open-sidebar-search',
  bookmarks: 'open-bookmarks',
  settings: 'open-settings',
};

function ActionIcon({ action }: { action: UserManualAction }) {
  if (action === 'workspace') return <FolderIcon className="manual-action-icon" />;
  if (action === 'search') return <SearchIcon className="manual-action-icon" />;
  if (action === 'bookmarks') return <BookmarkIcon className="manual-action-icon" size={15} />;
  return <SettingsIcon className="manual-action-icon" />;
}

export function UserManualTab({ language, settings }: UserManualTabProps) {
  const manual = getUserManualTranslations(language);
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredSections = useMemo(() => manual.sections.map((section) => ({
    ...section,
    cards: section.cards.filter((card) => [section.title, card.title, card.description, ...card.steps]
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalizedQuery)),
  })).filter((section) => section.cards.length > 0), [manual.sections, normalizedQuery]);

  const runAction = (action: UserManualAction) => {
    window.dispatchEvent(new CustomEvent(ACTION_EVENTS[action]));
  };

  return (
    <div className="user-manual">
      <header className="user-manual__header">
        <div>
          <h2>{manual.title}</h2>
          <p>{manual.subtitle}</p>
        </div>
        <div className="manual-search">
          <SearchIcon className="manual-search__icon" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={manual.searchPlaceholder} aria-label={manual.searchPlaceholder} />
        </div>
      </header>

      <nav className="user-manual__quick-actions" aria-label={manual.title}>
        {(Object.keys(manual.actions) as UserManualAction[]).map((action) => (
          <button key={action} type="button" onClick={() => runAction(action)}>
            <ActionIcon action={action} />
            <span>{manual.actions[action]}</span>
          </button>
        ))}
      </nav>

      {filteredSections.length > 0 ? (
        <div className="user-manual__sections">
          {filteredSections.map((section) => (
            <section key={section.id} className="manual-section" data-manual-section={section.id}>
              <h3>{section.title}</h3>
              <div className="manual-section__cards">
                {section.cards.map((card) => {
                  const shortcut = card.shortcutAction ? getEnabledShortcut(settings, card.shortcutAction) : undefined;
                  const action = card.action as UserManualAction | undefined;
                  return (
                    <article className="manual-card" key={card.title}>
                      <div className="manual-card__heading">
                        <h4>{card.title}</h4>
                        {shortcut && <kbd>{formatShortcutLabel(shortcut)}</kbd>}
                      </div>
                      <p>{card.description}</p>
                      <ol>{card.steps.map((step) => <li key={step}>{step}</li>)}</ol>
                      {action && (
                        <button type="button" className="card-action-btn manual-card__action" onClick={() => runAction(action)}>
                          <ActionIcon action={action} />
                          {manual.actions[action]}
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : <div className="user-manual__empty">{manual.noResults}</div>}
    </div>
  );
}
