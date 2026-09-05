export interface WorkspaceIdentityHistoryEntry { readonly key: string; readonly path: string; readonly fingerprint?: string; }
export interface ResolveWorkspaceIdentityInput { readonly workspacePath: string; readonly fingerprint?: string; readonly history?: readonly WorkspaceIdentityHistoryEntry[]; }
export interface WorkspaceIdentity { readonly key: string; readonly normalizedPath: string; readonly fingerprint?: string; readonly confidence: 'path' | 'moved-high-confidence' | 'new'; readonly movedFrom?: string; }
function normalizedPath(value: string): string { return value.replace(/\\/g, '/').replace(/\/+$/g, '').normalize('NFC'); }
function hash(value: string): string { let h = 0xcbf29ce484222325n, p = 0x100000001b3n; for (let i=0;i<value.length;i++){h^=BigInt(value.charCodeAt(i));h=BigInt.asUintN(64,h*p);} return h.toString(16).padStart(16,'0'); }
export function resolveWorkspaceIdentity(input: ResolveWorkspaceIdentityInput): WorkspaceIdentity {
  const path = normalizedPath(input.workspacePath); const history = input.history ?? [];
  const exact = history.find(entry => normalizedPath(entry.path) === path);
  if (exact) return { key: exact.key, normalizedPath: path, ...(input.fingerprint ? { fingerprint: input.fingerprint } : {}), confidence: 'path' };
  if (input.fingerprint) {
    const matches = history.filter(entry => entry.fingerprint === input.fingerprint);
    if (matches.length === 1) return { key: matches[0].key, normalizedPath: path, fingerprint: input.fingerprint, confidence: 'moved-high-confidence', movedFrom: normalizedPath(matches[0].path) };
  }
  return { key: `workspace-${hash(path)}`, normalizedPath: path, ...(input.fingerprint ? { fingerprint: input.fingerprint } : {}), confidence: 'new' };
}
