import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { describe, expect, it } from 'vitest';
import { exitTableAbove, exitTableToNewLine, rawTableOffsetsField, toggleTableRawEffect } from '../../../../ui/src/editor/tableVisualPlugin';

function view(doc: string) {
  return new EditorView({ state: EditorState.create({ doc, extensions: [rawTableOffsetsField] }), parent: document.body });
}

describe('table visual exit helpers', () => {
  it('exits below a table at document end with and without trailing newline', () => {
    const a = view('| a |\n|---|');
    exitTableToNewLine(a, a.state.doc.length);
    expect(a.state.doc.toString().endsWith('\n')).toBe(true);
    expect(a.state.selection.main.head).toBe(a.state.doc.length);
    const b = view('| a |\n|---|\n');
    exitTableToNewLine(b, b.state.doc.length);
    expect(b.state.doc.toString()).toBe('| a |\n|---|\n');
    const c = view('| a |\n|---|\nafter');
    exitTableToNewLine(c, 11);
    expect(c.state.selection.main.head).toBe(12);
    [a, b, c].forEach((v) => v.destroy());
  });

  it('exits above a table at the start or mid document', () => {
    const a = view('| a |');
    exitTableAbove(a, 0);
    expect(a.state.doc.toString()).toBe('\n| a |');
    const b = view('x\n| a |');
    exitTableAbove(b, 2);
    expect(b.state.selection.main.head).toBe(1);
    [a, b].forEach((v) => v.destroy());
  });

  it('maps raw table offsets through document changes', () => {
    const v = view('intro\n| a |\n|---|');
    v.dispatch({ effects: toggleTableRawEffect.of(6) });
    expect(v.state.field(rawTableOffsetsField).has(6)).toBe(true);
    v.dispatch({ changes: { from: 0, insert: 'xx' } });
    expect(v.state.field(rawTableOffsetsField).has(8)).toBe(true);
    v.dispatch({ effects: toggleTableRawEffect.of(8) });
    expect(v.state.field(rawTableOffsetsField).size).toBe(0);
    v.destroy();
  });
});
