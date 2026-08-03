import { FolderIcon, SearchIcon } from '../shared/icons';
import type { WorkspaceChoice } from './searchOverlayModel';

interface WorkspaceListTranslations {
  workspaces: string;
  includeWorkspace: string;
  excludeWorkspace: string;
  checkAllWorkspaces: string;
  uncheckAllWorkspaces: string;
}

interface SearchOverlayWorkspaceListProps {
  workspaces: readonly WorkspaceChoice[];
  selectedWorkspaceId: string;
  checkedWorkspaceIds: ReadonlySet<string>;
  counts: ReadonlyMap<string, number>;
  translations: WorkspaceListTranslations;
  onSelect: (workspaceId: string) => void;
  onToggle: (workspaceId: string, checked: boolean) => void;
}

export function SearchOverlayWorkspaceList({
  workspaces,
  selectedWorkspaceId,
  checkedWorkspaceIds,
  counts,
  translations: t,
  onSelect,
  onToggle,
}: SearchOverlayWorkspaceListProps) {
  const actualWorkspaces = workspaces.filter((workspace) => workspace.id !== 'all');
  const allChecked = actualWorkspaces.length > 0 && actualWorkspaces.every((workspace) => checkedWorkspaceIds.has(workspace.id));

  return (
    <aside className="search-overlay-workspaces" aria-label={t.workspaces}>
      <div className="search-overlay-section-title">{t.workspaces}</div>
      <div className="search-overlay-workspace-list">
        {workspaces.map((workspace) => {
          const isAll = workspace.id === 'all';
          const checked = isAll ? allChecked : checkedWorkspaceIds.has(workspace.id);
          const checkboxLabel = isAll
            ? (checked ? t.uncheckAllWorkspaces : t.checkAllWorkspaces)
            : (checked ? t.excludeWorkspace : t.includeWorkspace).replace('{workspace}', workspace.label);

          return (
            <div
              key={workspace.id}
              className={`search-overlay-workspace${selectedWorkspaceId === workspace.id ? ' is-active' : ''}`}
            >
              <input
                type="checkbox"
                className="search-overlay-workspace__checkbox scope-focus-checkbox"
                checked={checked}
                onChange={(event) => onToggle(workspace.id, event.target.checked)}
                aria-label={checkboxLabel}
                title={checkboxLabel}
              />
              <button
                type="button"
                className="search-overlay-workspace__select"
                onClick={() => onSelect(workspace.id)}
                aria-pressed={selectedWorkspaceId === workspace.id}
              >
                <span className="search-overlay-workspace__badge" aria-hidden="true">
                  {isAll ? <SearchIcon size={13} /> : <FolderIcon size={13} />}
                </span>
                <span className="search-overlay-workspace__copy">
                  <span className="search-overlay-workspace__name">{workspace.label}</span>
                  {workspace.path && <span className="search-overlay-workspace__path">{workspace.path}</span>}
                </span>
                <span className="search-overlay-workspace__count">{counts.get(workspace.id) ?? 0}</span>
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
