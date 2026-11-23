import { describe, expect, it } from 'vitest';
import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView, runScopeHandlers } from '@codemirror/view';
import { createTableVisualExtension } from '../../../../ui/src/editor/tableVisualPlugin';

const doc = 'intro\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\nafter';

function mount(source = doc) {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  return new EditorView({ state: EditorState.create({ doc: source, extensions: [createTableVisualExtension(() => 'en')] }), parent });
}

const key = (view: EditorView, name: string) => runScopeHandlers(view, new KeyboardEvent('keydown', { key: name }), 'editor');
const at = (view: EditorView, pos: number, head = pos) => view.dispatch({ selection: EditorSelection.single(pos, head) });

describe('table boundary keymap', () => {
  it('enters the table from the line above and below', () => {
    const view = mount();
    at(view, 2);
    expect(key(view, 'ArrowDown')).toBe(true);
    const blank = doc.indexOf('\n\n') + 1;
    at(view, blank);
    expect(key(view, 'ArrowUp')).toBe(true);
    at(view, 0, 3);
    expect(key(view, 'ArrowDown')).toBe(false);
    at(view, doc.length);
    expect(key(view, 'ArrowUp')).toBe(false);
    view.destroy();
  });

  it('backspace on the empty line after a table joins it to the table', () => {
    const view = mount();
    const blank = doc.indexOf('\n\n') + 1;
    at(view, blank);
    expect(key(view, 'Backspace')).toBe(true);
    expect(view.state.doc.toString()).not.toContain('\n\n');
    at(view, 0, 2);
    expect(key(view, 'Backspace')).toBe(false);
    const plain = mount('one\n\ntwo');
    at(plain, 4);
    expect(key(plain, 'Backspace')).toBe(false);
  });
});
