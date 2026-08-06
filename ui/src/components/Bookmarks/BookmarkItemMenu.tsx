import type { BookmarkRecord } from '../../bookmarks/types.ts';
import { SidebarItemMenu, type SidebarItemMenuItem } from '../Sidebar/SidebarItemMenu';
import { BookmarkIcon, EditBookmarkIcon, RemoveBookmarkIcon } from './BookmarkIcons';

interface BookmarkItemMenuProps {
  bookmark: BookmarkRecord;
  anchor: HTMLElement;
  sidebar: HTMLElement;
  labels: {
    menuLabel: string;
    goTo: string;
    editName: string;
    delete: string;
  };
  onNavigate: (bookmark: BookmarkRecord) => void;
  onRename: (bookmark: BookmarkRecord) => void;
  onDelete: (bookmark: BookmarkRecord) => void;
  onClose: () => void;
}

export function BookmarkItemMenu({ bookmark, anchor, sidebar, labels, onNavigate, onRename, onDelete, onClose }: BookmarkItemMenuProps) {
  const items: readonly SidebarItemMenuItem[] = [
    { id: 'go-to-bookmark', label: labels.goTo, icon: <BookmarkIcon />, onSelect: () => onNavigate(bookmark) },
    { id: 'edit-bookmark', label: labels.editName, icon: <EditBookmarkIcon />, onSelect: () => onRename(bookmark) },
    { id: 'delete-bookmark', label: labels.delete, icon: <RemoveBookmarkIcon />, dividerBefore: true, onSelect: () => onDelete(bookmark) },
  ];
  return <SidebarItemMenu anchor={anchor} sidebar={sidebar} menuLabel={labels.menuLabel} items={items} onClose={onClose} />;
}
