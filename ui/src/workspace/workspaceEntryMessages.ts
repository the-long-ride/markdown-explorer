import type { Translations } from '../contexts/translations';
import type { WorkspaceEntryFailureReason } from '../types';
import type { WorkspaceEntryNameError } from './workspaceEntryName';

type SidebarTranslations = Translations['sidebar'];
export type WorkspaceEntryProblem = WorkspaceEntryNameError | WorkspaceEntryFailureReason;

const ERROR_KEYS = {
  empty: 'entryErrorEmpty',
  invalid: 'entryErrorInvalid',
  'invalid-name': 'entryErrorInvalid',
  reserved: 'entryErrorReserved',
  protected: 'entryErrorProtected',
  exists: 'entryErrorExists',
  'permission-denied': 'entryErrorPermission',
  missing: 'entryErrorMissing',
  'outside-workspace': 'entryErrorOutside',
  unsupported: 'entryErrorUnsupported',
  failed: 'entryErrorFailed',
} as const satisfies Record<WorkspaceEntryProblem, keyof SidebarTranslations>;

export function fillTemplate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.split(`{${key}}`).join(String(value)),
    template,
  );
}

export function formatEntryError(t: SidebarTranslations, problem: WorkspaceEntryProblem, name: string): string {
  return fillTemplate(t[ERROR_KEYS[problem]], { name });
}
