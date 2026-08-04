import type { MdFile } from '../../types';

export function getActiveFolderPaths(
  currentFile: string | null | undefined,
  fileList: readonly MdFile[],
): ReadonlySet<string> {
  const paths = new Set<string>();
  if (!currentFile) return paths;
  const activeFile = fileList.find((file) => file.fsPath === currentFile);
  if (!activeFile) return paths;

  let folderPath = '';
  for (const part of (activeFile.parts ?? []).slice(0, -1)) {
    folderPath = folderPath ? `${folderPath}/${part}` : part;
    paths.add(folderPath);
  }
  return paths;
}
