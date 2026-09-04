import { describe, expect, it } from 'vitest';
import { getMermaidBookmarkDefaultName } from '../../../../ui/src/bookmarks/bookmarkDefaultName.ts';

describe('bookmarkDefaultName', () => {
  it('extracts participant or actor in sequence diagrams', () => {
    const sequence = `
      sequenceDiagram
      actor User as "Registered User"
      participant API as Backend Service
      User->>API: Login
    `;
    expect(getMermaidBookmarkDefaultName(sequence)).toBe('Registered User');

    const participantOnly = `
      sequenceDiagram
      participant Gateway
      Gateway->>Worker: Task
    `;
    expect(getMermaidBookmarkDefaultName(participantOnly)).toBe('Gateway');
  });

  it('extracts initial graph entrypoints from flowcharts with different shapes', () => {
    const flowchart = `
      flowchart TD
      Start[(Database Setup)] --> Process{Validate}
      Process --> End([Complete])
    `;
    expect(getMermaidBookmarkDefaultName(flowchart)).toBe('Database Setup');

    const subroutine = `
      graph LR
      A[[Subroutine A]] --> B[Node B]
    `;
    expect(getMermaidBookmarkDefaultName(subroutine)).toBe('Subroutine A');

    const flag = `
      graph TD
      A>Flag Node] --> B((Circle Node))
    `;
    expect(getMermaidBookmarkDefaultName(flag)).toBe('Flag Node');
  });

  it('handles stateDiagram initial entrypoint [*]', () => {
    const state = `
      stateDiagram-v2
      [*] --> InitialState
      InitialState --> Active
    `;
    expect(getMermaidBookmarkDefaultName(state)).toBe('InitialState');
  });

  it('handles state aliases', () => {
    const stateWithAlias = `
      stateDiagram
      state "Power Off" as s1
      s1 --> s2
    `;
    expect(getMermaidBookmarkDefaultName(stateWithAlias)).toBe('Power Off');
  });

  it('cleans HTML tags and quotes from labels', () => {
    const htmlLabels = `
      flowchart TD
      A["<b>Bold</b><br/>Multi Line"] --> B
    `;
    expect(getMermaidBookmarkDefaultName(htmlLabels)).toBe('Bold Multi Line');
  });

  it('returns empty string for empty diagram or header-only content', () => {
    expect(getMermaidBookmarkDefaultName('')).toBe('');
    expect(getMermaidBookmarkDefaultName('%% just a comment')).toBe('');
    expect(getMermaidBookmarkDefaultName('graph TD\n%% comment\nstyle A fill:#fff')).toBe('');
  });
});
