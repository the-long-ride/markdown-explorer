import type { GitRepositoryCommit } from './contracts';

export type RepositoryView =
  | { readonly mode: 'live' }
  | { readonly mode: 'revision'; readonly oid: string; readonly headOid: string };

export interface PersistedRepositoryRevisionSelection {
  readonly oid: string;
}

export type PersistedRepositoryRevisionSelections = Record<
  string,
  PersistedRepositoryRevisionSelection
>;

export function repositoryWorkspaceKey(workspacePath?: string, workspaceName?: string): string {
  const path = String(workspacePath ?? '').trim();
  if (path) return path;
  return String(workspaceName ?? '').trim();
}

export function filterRepositoryCommits(
  commits: readonly GitRepositoryCommit[],
  query: string,
): readonly GitRepositoryCommit[] {
  const needle = String(query ?? '').trim().toLocaleLowerCase();
  if (!needle) return commits;
  return commits.filter((commit) => [commit.oid, commit.shortOid, commit.author, commit.subject]
    .some((value) => value.toLocaleLowerCase().includes(needle)));
}

export function readPersistedRevision(
  selections: PersistedRepositoryRevisionSelections | undefined,
  workspaceKey: string,
): string | null {
  const key = String(workspaceKey ?? '').trim();
  if (!key) return null;
  const oid = String(selections?.[key]?.oid ?? '').trim();
  return oid || null;
}

export function writePersistedRevision(
  selections: PersistedRepositoryRevisionSelections | undefined,
  workspaceKey: string,
  oid: string | null,
): PersistedRepositoryRevisionSelections {
  const key = String(workspaceKey ?? '').trim();
  const next = { ...(selections ?? {}) };
  if (!key) return next;

  const normalizedOid = String(oid ?? '').trim();
  if (!normalizedOid) {
    delete next[key];
    return next;
  }

  next[key] = { oid: normalizedOid };
  return next;
}
