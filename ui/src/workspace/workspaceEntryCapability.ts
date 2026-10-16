import { isWebsiteDemoRuntime } from '../insights/runtimeCapabilities';
import type { AppRuntime, WorkspaceEntryDeleteMode } from '../types';

export interface WorkspaceEntryCapability {
  readonly create: boolean;
  readonly deleteMode: WorkspaceEntryDeleteMode | null;
}

export const NO_WORKSPACE_ENTRY_CAPABILITY: WorkspaceEntryCapability = { create: false, deleteMode: null };

/** Distinguishes the simulated demo workspace from explicit browser file mode. */
export function isWebDemoTestMode(): boolean {
  return isWebsiteDemoRuntime() && new URLSearchParams(window.location.search).get('mode') !== 'file';
}

/** Derived like supportsShellLocation: browsers delete permanently, every other host uses the OS trash. */
export function getWorkspaceEntryCapability(appRuntime: AppRuntime, hasWorkspace: boolean): WorkspaceEntryCapability {
  if (!hasWorkspace) return NO_WORKSPACE_ENTRY_CAPABILITY;
  return { create: true, deleteMode: appRuntime === 'chrome' ? 'permanent' : 'trash' };
}
