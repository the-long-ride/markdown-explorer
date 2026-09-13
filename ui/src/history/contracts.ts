export interface GitCapability {
  readonly supported: boolean;
  readonly repositoryRoot?: string;
  readonly reason?: 'unsupported-runtime' | 'git-unavailable' | 'not-repository';
}

export interface GitRevisionSummary {
  readonly oid: string;
  readonly shortOid: string;
  readonly author: string;
  readonly authoredAt: string;
  readonly subject: string;
  readonly path: string;
}

export interface GitRevisionSnapshot {
  readonly oid: string;
  readonly path: string;
  readonly source: string;
}

export type GitCompareSide =
  | { readonly kind: 'revision'; readonly oid: string; readonly path: string }
  | { readonly kind: 'current'; readonly path: string };

export interface GitComparisonSources {
  readonly leftSource: string;
  readonly rightSource: string;
  readonly leftLabel?: string;
  readonly rightLabel?: string;
}
