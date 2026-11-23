import { describe, expect, it } from 'vitest';
import { getMermaidBookmarkDefaultName } from '../../../../ui/src/bookmarks/bookmarkDefaultName';

describe('getMermaidBookmarkDefaultName edge cases', () => {
  it('uses the first declared node when there are no edges', () => {
    expect(getMermaidBookmarkDefaultName('flowchart TD\n%% comment\nStart[Begin here]\n')).toBe('Begin here');
    expect(getMermaidBookmarkDefaultName('graph LR\nonlyNode\n')).toBe('onlyNode');
  });
  it('handles state aliases, empty labels and edges to undeclared targets', () => {
    expect(getMermaidBookmarkDefaultName('stateDiagram-v2\nstate "Waiting" as W\nW --> Done\n')).toBeTruthy();
    expect(getMermaidBookmarkDefaultName('graph TD\nA[""] --> B\nA --> C\n')).toBeTruthy();
    expect(getMermaidBookmarkDefaultName('graph TD\n--> \n')).toBe('');
    expect(getMermaidBookmarkDefaultName('')).toBe('');
  });
});
