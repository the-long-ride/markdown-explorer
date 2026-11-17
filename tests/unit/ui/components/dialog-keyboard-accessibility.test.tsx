import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookmarkBatchDeleteDialog } from '../../../../ui/src/components/Bookmarks/BookmarkBatchDeleteDialog';
import { BookmarkDialog } from '../../../../ui/src/components/Bookmarks/BookmarkDialog';
import { DocumentConflictModal } from '../../../../ui/src/components/Modal/DocumentConflictModal';
import { UnsavedChangesModal } from '../../../../ui/src/components/Modal/UnsavedChangesModal';
import { WorkspaceSelectionConfirmModal } from '../../../../ui/src/components/Modal/WorkspaceSelectionConfirmModal';
import { SwitchWorkspaceModal } from '../../../../ui/src/components/Modal/SwitchWorkspaceModal';
import { SupportPromptModal } from '../../../../ui/src/components/Modal/SupportPromptModal';
import { TermsModal } from '../../../../ui/src/components/Modal/TermsModal';
import { AvailableUpdateDialog } from '../../../../ui/src/components/Settings/AvailableUpdateDialog';
import { DownloadedUpdateDialog, BannedShortcutDialog, ResetShortcutsConfirmDialog } from '../../../../ui/src/components/Settings/SettingsModalDialogs';
import { SidebarConfirmDialog } from '../../../../ui/src/components/Sidebar/SidebarConfirmDialog';

const mockState: any = {
  theme: 'dark',
  settings: { language: 'en' },
  workspaceName: 'TestWorkspace',
};

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({
    state: mockState,
    setTheme: vi.fn(),
    setThemeStyle: vi.fn(),
    updateSettings: vi.fn(),
  }),
}));

vi.mock('../../../../ui/src/hooks/useGitHubStars', () => ({
  useGitHubStars: () => 42,
}));

afterEach(cleanup);

describe('Dialog keyboard accessibility (Escape secondary, Enter primary)', () => {
  describe('BookmarkBatchDeleteDialog', () => {
    it('listens to Escape for cancel and Enter for confirm', () => {
      const onCancel = vi.fn();
      const onConfirm = vi.fn();
      render(
        <BookmarkBatchDeleteDialog
          open={true}
          count={3}
          title="Delete Bookmarks"
          message="Delete {count} bookmarks?"
          cancelLabel="Cancel"
          confirmLabel="Delete"
          onCancel={onCancel}
          onConfirm={onConfirm}
        />,
      );

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onCancel).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(document, { key: 'Enter' });
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe('BookmarkDialog', () => {
    it('listens to Escape for close and Enter for save', () => {
      const onClose = vi.fn();
      const onSave = vi.fn();
      render(
        <BookmarkDialog
          open={true}
          title="Edit Bookmark"
          label="Name"
          placeholder="Enter name"
          initialValue="My Bookmark"
          saveLabel="Save"
          cancelLabel="Cancel"
          onClose={onClose}
          onSave={onSave}
        />,
      );

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(document, { key: 'Enter' });
      expect(onSave).toHaveBeenCalledWith('My Bookmark');
    });
  });

  describe('DocumentConflictModal', () => {
    it('listens to Enter for primary Compare action', () => {
      const onCompare = vi.fn();
      const onReload = vi.fn();
      const onKeepMine = vi.fn();
      render(
        <DocumentConflictModal
          fileName="doc.md"
          conflict={{ diskSource: '# Disk', diskRevision: '2:1' }}
          onCompare={onCompare}
          onReload={onReload}
          onKeepMine={onKeepMine}
        />,
      );

      fireEvent.keyDown(document, { key: 'Enter' });
      expect(onCompare).toHaveBeenCalledTimes(1);
      expect(onReload).not.toHaveBeenCalled();
      expect(onKeepMine).not.toHaveBeenCalled();
    });
  });

  describe('UnsavedChangesModal', () => {
    it('listens to Escape for cancel and Enter for save', () => {
      const onChoose = vi.fn();
      render(<UnsavedChangesModal fileName="notes.md" onChoose={onChoose} />);

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onChoose).toHaveBeenCalledWith('cancel');

      fireEvent.keyDown(document, { key: 'Enter' });
      expect(onChoose).toHaveBeenCalledWith('save');
    });
  });

  describe('WorkspaceSelectionConfirmModal', () => {
    it('listens to Escape for close and Enter for confirm', () => {
      const onClose = vi.fn();
      const onConfirm = vi.fn();
      render(<WorkspaceSelectionConfirmModal isOpen={true} onClose={onClose} onConfirm={onConfirm} />);

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(document, { key: 'Enter' });
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe('SwitchWorkspaceModal', () => {
    it('listens to Escape for close and Enter for confirm', () => {
      const onClose = vi.fn();
      const onConfirm = vi.fn();
      render(
        <SwitchWorkspaceModal
          isOpen={true}
          targetPath="/new/path"
          onClose={onClose}
          onConfirm={onConfirm}
        />,
      );

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(document, { key: 'Enter' });
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe('SupportPromptModal', () => {
    it('listens to Escape for close and Enter for star', () => {
      const onClose = vi.fn();
      const onStar = vi.fn();
      render(<SupportPromptModal isOpen={true} onClose={onClose} onStar={onStar} />);

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledWith(false);

      fireEvent.keyDown(window, { key: 'Enter' });
      expect(onStar).toHaveBeenCalledWith(false);
    });
  });

  describe('TermsModal', () => {
    it('listens to Enter for agree when checkbox is checked', () => {
      const onAgree = vi.fn();
      render(<TermsModal isOpen={true} onAgree={onAgree} />);

      // Enter without checking checkbox should not trigger onAgree
      fireEvent.keyDown(document, { key: 'Enter' });
      expect(onAgree).not.toHaveBeenCalled();

      // Check the checkbox
      fireEvent.click(screen.getByRole('checkbox'));

      // Enter after checking checkbox triggers onAgree
      fireEvent.keyDown(document, { key: 'Enter' });
      expect(onAgree).toHaveBeenCalledTimes(1);
    });
  });

  describe('AvailableUpdateDialog', () => {
    it('listens to Escape for later and Enter for download', () => {
      const onLater = vi.fn();
      const onDownload = vi.fn();
      const t = {
        newerVersionStatus: 'Current: {current}, Latest: {latest}',
        updateLater: 'Later',
        updateSkipVersion: 'Skip this version',
        update: {
          availableTitle: 'Version {version} Available',
          viewChangelog: 'View Changelog',
          downloadButton: 'Download Update',
        },
      } as any;

      render(
        <AvailableUpdateDialog
          version="2.0.0"
          currentVersion="1.0.0"
          t={t}
          canDownloadUpdate={true}
          onDownload={onDownload}
          onLater={onLater}
          onSkipVersion={vi.fn()}
          onChangelog={vi.fn()}
        />,
      );

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onLater).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(document, { key: 'Enter' });
      expect(onDownload).toHaveBeenCalledTimes(1);
    });
  });

  describe('SettingsModalDialogs', () => {
    it('DownloadedUpdateDialog: listens to Escape for schedule and Enter for restart', () => {
      const onSchedule = vi.fn();
      const onRestart = vi.fn();
      const t = {
        update: {
          restartPromptTitle: 'Update Ready',
          restartPromptBody: 'Version {version}',
          updateOnExit: 'Update on exit',
          restartAndUpdate: 'Restart now',
        },
      };

      render(
        <DownloadedUpdateDialog
          t={t}
          version="1.2.3"
          onSchedule={onSchedule}
          onRestart={onRestart}
        />,
      );

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onSchedule).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(document, { key: 'Enter' });
      expect(onRestart).toHaveBeenCalledTimes(1);
    });

    it('BannedShortcutDialog: listens to Escape and Enter for close', () => {
      const onClose = vi.fn();
      const t = {
        ui: { closeWarning: 'Close', warningMascotAlt: 'Warning' },
        bannedShortcutTitle: 'Banned Shortcut',
        bannedShortcutDismiss: 'Dismiss',
      };

      render(<BannedShortcutDialog t={t} error="Cannot bind key" mascot="" onClose={onClose} />);

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(document, { key: 'Enter' });
      expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('ResetShortcutsConfirmDialog: listens to Escape for cancel and Enter for confirm', () => {
      const onCancel = vi.fn();
      const onConfirm = vi.fn();
      const t = {
        cancelResetShortcuts: 'Cancel',
        confirmResetShortcuts: 'Reset',
        resetShortcutsConfirmTitle: 'Reset Shortcuts?',
        resetShortcutsConfirmBody: 'Are you sure?',
      };

      render(<ResetShortcutsConfirmDialog t={t} onCancel={onCancel} onConfirm={onConfirm} />);

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onCancel).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(document, { key: 'Enter' });
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe('SidebarConfirmDialog', () => {
    it('listens to Escape for cancel and Enter for confirm', () => {
      const onCancel = vi.fn();
      const onConfirm = vi.fn();
      render(
        <SidebarConfirmDialog
          title="Delete Item"
          message="Are you sure?"
          cancelLabel="Cancel"
          confirmLabel="Delete"
          onCancel={onCancel}
          onConfirm={onConfirm}
        />,
      );

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onCancel).toHaveBeenCalledTimes(1);

      // Focus on confirm button and press Enter
      const confirmBtn = screen.getByRole('button', { name: 'Delete' });
      confirmBtn.focus();
      fireEvent.keyDown(confirmBtn, { key: 'Enter' });
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });
});
