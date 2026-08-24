import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('Mermaid content lifecycle parity', () => {
  it('uses one shared Mermaid appearance lifecycle in document content and Scope View', () => {
    const contentEffects = read('ui/src/components/Content/useContentEffects.ts');
    const scopeView = read('ui/src/components/Modal/ScopeViewModal.tsx');
    const sharedLifecycle = read('ui/src/components/Content/mermaidContentLifecycle.ts');

    expect(sharedLifecycle).toContain('createMermaidRerenderLifecycle');
    expect(sharedLifecycle).toContain('subscribeToAutoMermaidTheme');
    expect(contentEffects).toContain('installMermaidContentLifecycle');
    expect(scopeView).toContain('installMermaidContentLifecycle');
  });
});
