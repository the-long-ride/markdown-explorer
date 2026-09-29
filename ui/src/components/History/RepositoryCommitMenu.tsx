import type { GitRepositoryCommit } from '../../history/contracts';
import { SidebarItemMenu, type SidebarItemMenuItem } from '../Sidebar/SidebarItemMenu';
import { CopyIcon, HomeIcon, ScopeIcon } from '../shared/icons';

export interface RepositoryCommitMenuProps {
  commit: GitRepositoryCommit;
  anchor: HTMLElement;
  activeRevisionOid: string | null;
  onCopy: (value: string, label: string) => void;
  onActivateRevision: (oid: string) => void;
  onReturnToHead: () => void;
  onClose: () => void;
}

export function RepositoryCommitMenu({
  commit,
  anchor,
  activeRevisionOid,
  onCopy,
  onActivateRevision,
  onReturnToHead,
  onClose,
}: RepositoryCommitMenuProps) {
  const sidebar = anchor.closest('.sidebar') as HTMLElement | null;
  if (!sidebar) return null;

  const items: SidebarItemMenuItem[] = [
    {
      id: 'copy-sha',
      label: `SHA ${commit.shortOid}`,
      icon: <CopyIcon size={14} />,
      onSelect: () => onCopy(commit.oid, 'Commit SHA'),
    },
    {
      id: 'copy-author',
      label: `Author · ${commit.author}`,
      icon: <CopyIcon size={14} />,
      onSelect: () => onCopy(commit.author, 'Author'),
    },
    {
      id: 'view-workspace',
      label: 'View workspace at this commit',
      icon: <ScopeIcon size={14} />,
      dividerBefore: true,
      onSelect: () => onActivateRevision(commit.oid),
    },
  ];

  if (activeRevisionOid) {
    items.push({
      id: 'return-head',
      label: 'Back to current HEAD',
      icon: <HomeIcon size={14} />,
      onSelect: onReturnToHead,
    });
  }

  return (
    <SidebarItemMenu
      anchor={anchor}
      sidebar={sidebar}
      menuLabel={`Commit ${commit.shortOid}`}
      items={items}
      onClose={onClose}
      align="left"
    />
  );
}
