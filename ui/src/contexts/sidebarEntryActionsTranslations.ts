import type { AppLanguage, Translations } from './translations';
type Copy = Pick<Translations['sidebar'], 'renameFile' | 'renameFolder' | 'deleteFile' | 'deleteFolder' | 'permanentlyDelete'>;
const copy = (renameFile: string, renameFolder: string, deleteFile: string, deleteFolder: string, permanentlyDelete: string): Copy => ({ renameFile, renameFolder, deleteFile, deleteFolder, permanentlyDelete });
export const SIDEBAR_ENTRY_ACTIONS: Record<AppLanguage, Copy> = {
  en: copy('Rename file', 'Rename folder', 'Delete file', 'Delete folder', 'Permanently Delete'),
  vi: copy('Đổi tên tệp', 'Đổi tên thư mục', 'Xóa tệp', 'Xóa thư mục', 'Xóa vĩnh viễn'),
  fr: copy('Renommer le fichier', 'Renommer le dossier', 'Supprimer le fichier', 'Supprimer le dossier', 'Supprimer définitivement'),
  es: copy('Renombrar archivo', 'Renombrar carpeta', 'Eliminar archivo', 'Eliminar carpeta', 'Eliminar permanentemente'),
  zh: copy('重命名文件', '重命名文件夹', '删除文件', '删除文件夹', '永久删除'),
  no: copy('Gi filen nytt navn', 'Gi mappen nytt navn', 'Slett fil', 'Slett mappe', 'Slett permanent'),
  ja: copy('ファイル名を変更', 'フォルダー名を変更', 'ファイルを削除', 'フォルダーを削除', '完全に削除'),
  ko: copy('파일 이름 바꾸기', '폴더 이름 바꾸기', '파일 삭제', '폴더 삭제', '영구 삭제'),
  ru: copy('Переименовать файл', 'Переименовать папку', 'Удалить файл', 'Удалить папку', 'Удалить навсегда'),
};
