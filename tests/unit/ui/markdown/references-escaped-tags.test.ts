import { describe, expect, it } from 'vitest';
import { extractDocumentReferences } from '../../../../ui/src/markdown/references';

describe('extractDocumentReferences prose tag escapes', () => {
  it('skips escaped hashtags and keeps nested tags', () => {
    const result = extractDocumentReferences('\\#skip (#keep/sub) #other\n') as any;
    expect(JSON.stringify(result)).not.toContain('"skip"');
    expect(JSON.stringify(result)).toContain('keep/sub');
  });
});
