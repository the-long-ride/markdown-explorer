import type { FolderNode, MdFile } from "../types";
import { scanWorkspaceIncrementally } from "./incrementalScan";
import { normalizePanelPath } from "./panelNavigation";

export interface RefreshFromWatchHost {
  readonly documentConversionEnabled: boolean;
  readonly scanGeneration: number;
  readonly currentFile: string | null;
  readonly workspaceName: string;
  postMessage: (msg: unknown) => PromiseLike<unknown> | void;
  bumpScanGeneration: () => number;
  isCurrentScan: (gen: number) => boolean;
  setFlat: (flat: MdFile[]) => void;
}

export async function refreshPanelFromWatch(
  host: RefreshFromWatchHost,
  changedPath?: string | null,
): Promise<void> {
  const gen = host.bumpScanGeneration();
  await host.postMessage({ command: "workspaceScanProgress", scannedFiles: 0, active: true });

  const publish = (next: { fileList: MdFile[]; tree: FolderNode | null }) => {
    if (!host.isCurrentScan(gen)) return;
    host.setFlat(next.fileList);
    void host.postMessage({
      command: "workspaceFilesChanged",
      ...next,
      workspaceName: host.workspaceName,
      documentConversionEnabled: host.documentConversionEnabled,
    });
  };

  const result = await scanWorkspaceIncrementally({
    documentConversionEnabled: host.documentConversionEnabled,
    isCurrent: () => host.isCurrentScan(gen),
    onProgress: (scannedFiles) => {
      void host.postMessage({ command: "workspaceScanProgress", scannedFiles, active: true });
    },
    onReveal: publish,
    onChanged: publish,
  });

  if (!result) return;

  host.setFlat(result.flat);
  await host.postMessage({ command: "workspaceScanProgress", scannedFiles: result.flat.length, active: false });

  if (
    changedPath &&
    host.currentFile &&
    normalizePanelPath(changedPath) === normalizePanelPath(host.currentFile)
  ) {
    await host.postMessage({ command: "currentFileChanged", filePath: host.currentFile });
  }
}
