import type { GitRepositoryCommit } from '../../history/contracts';
import { SidebarItemMenu, type SidebarItemMenuItem } from '../Sidebar/SidebarItemMenu';

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
      onSelect: () => onCopy(commit.oid, 'Commit SHA'),
    },
    {
      id: 'copy-author',
      label: `Author · ${commit.author}`,
      onSelect: () => onCopy(commit.author, 'Author'),
    },
    {
      id: 'view-workspace',
      label: 'View workspace at this commit',
      dividerBefore: true,
      onSelect: () => onActivateRevision(commit.oid),
    },
  ];

  if (activeRevisionOid) {
    items.push({
      id: 'return-head',
      label: 'Back to current HEAD',
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
    />
  );
}
