import type { Translations } from './translationTypes';

type SidebarFileOpsKey =
  'renameFile' | 'renameFolder' | 'deleteFile' | 'deleteFolder' | 'permanentlyDelete'
  | 'newFile'
  | 'newFolder'
  | 'newFileMenu'
  | 'newFolderMenu'
  | 'newFileInputLabel'
  | 'newFolderInputLabel'
  | 'selectMode'
  | 'exitSelectMode'
  | 'selectItem'
  | 'unpinSelected'
  | 'unpinSelectedConfirmBody'
  | 'deleteSelected'
  | 'deleteTrashTitle'
  | 'deletePermanentTitle'
  | 'deleteTrashBody'
  | 'deletePermanentBody'
  | 'deleteTrashConfirm'
  | 'deletePermanentConfirm'
  | 'deleteMore'
  | 'deleteUnsavedWarning'
  | 'deleteFailed'
  | 'entryUnlistedType'
  | 'entryErrorEmpty'
  | 'entryErrorExists'
  | 'entryErrorInvalid'
  | 'entryErrorReserved'
  | 'entryErrorProtected'
  | 'entryErrorPermission'
  | 'entryErrorMissing'
  | 'entryErrorOutside'
  | 'entryErrorUnsupported'
  | 'entryErrorFailed';

/** English sidebar strings for create / select / delete file operations. */
export const SIDEBAR_FILE_OPS_EN: Pick<Translations['sidebar'], SidebarFileOpsKey> = {
  renameFile: "Rename file",
  renameFolder: "Rename folder",
  deleteFile: "Delete file",
  deleteFolder: "Delete folder",
  permanentlyDelete: "Permanently Delete",
  newFile: "New File",
  newFolder: "New Folder",
  newFileMenu: "New File…",
  newFolderMenu: "New Folder…",
  newFileInputLabel: "New file name",
  newFolderInputLabel: "New folder name",
  selectMode: "Entry selection mode",
  exitSelectMode: "Exit selection mode",
  selectItem: "Select {name}",
  unpinSelected: "Unpin selected ({count})",
  unpinSelectedConfirmBody: "Remove {count} pinned items from the top of the Files tab?",
  deleteSelected: "Delete selected ({count})",
  deleteTrashTitle: "Move {count} items to Trash?",
  deletePermanentTitle: "Permanently delete {count} items?",
  deleteTrashBody: "You can restore them from the system Trash.",
  deletePermanentBody: "Permanently delete — this cannot be undone.",
  deleteTrashConfirm: "Move to Trash",
  deletePermanentConfirm: "Delete permanently",
  deleteMore: "and {count} more",
  deleteUnsavedWarning: "{count} files have unsaved changes that will be lost.",
  deleteFailed: "Could not delete: {names}",
  entryUnlistedType: "This file type won't appear in the Files tree",
  entryErrorEmpty: "A file or folder name must be provided.",
  entryErrorExists: "{name} already exists in this folder.",
  entryErrorInvalid: "{name} is not a valid file or folder name.",
  entryErrorReserved: "{name} is a reserved name on Windows.",
  entryErrorProtected: "{name} is protected.",
  entryErrorPermission: "Permission denied.",
  entryErrorMissing: "The target no longer exists.",
  entryErrorOutside: "The location is outside the workspace.",
  entryErrorUnsupported: "Not available in a single-file workspace.",
  entryErrorFailed: "The operation failed.",
};
