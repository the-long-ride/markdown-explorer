import { createPortal } from 'react-dom';
import { useRepositorySnapshot } from '../../contexts/RepositorySnapshotContext';
import { RepositorySnapshotContent } from './RepositorySnapshotContent';

export function RepositorySnapshotPortal() {
  const { repositoryView } = useRepositorySnapshot();
  if (repositoryView.mode !== 'revision' || typeof document === 'undefined') return null;
  const target = document.querySelector('.content-shell__main');
  if (!target) return null;
  return createPortal(<RepositorySnapshotContent />, target);
}
