/** VS Code workspace scan constants. */
export const WORKSPACE_TITLE_CHUNK_BYTES = 8 * 1024;
export const WORKSPACE_SCAN_REVEAL_DELAY_MS = 3000;
export const WORKSPACE_SCAN_BATCH_SIZE = 32;
export const WORKSPACE_SCAN_PROGRESS_BATCH_SIZE = 100;
export const DEFAULT_WORKSPACE_EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
] as const;
export const MARKDOWN_WORKSPACE_INCLUDE_GLOB = '**/*.{md,mdx,txt}';
export const CONVERTIBLE_WORKSPACE_INCLUDE_GLOB =
  '**/*.{md,mdx,doc,docx,pdf,html,xls,xlsx,xlm,pptx,odt,odp,ods,rtf,txt}';
