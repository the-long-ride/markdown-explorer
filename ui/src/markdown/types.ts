// ============================================================
// markdown/types.ts — Shared types for the Markdown engine
// ============================================================

/** Table of contents entry */
export interface TocEntry {
  readonly level: number;
  readonly text: string;
  readonly id: string;
}
