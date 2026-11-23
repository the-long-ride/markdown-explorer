import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { createTableVisualExtension } from '../../../../ui/src/editor/tableVisualPlugin';

function mount(doc: string) {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  const view = new EditorView({ state: EditorState.create({ doc, extensions: [createTableVisualExtension(() => 'en')] }), parent });
  const widgets = parent.querySelectorAll('.cm-table-widget');
  widgets.forEach((w) => { (w as HTMLElement).getBoundingClientRect = () => ({ top: 0, bottom: 10, left: 0, right: 100, width: 100, height: 10, x: 0, y: 0 }) as DOMRect; });
  return { view, widget: widgets[widgets.length - 1] as HTMLElement | undefined };
}

const press = (target: Element, clientY: number, button = 0) => {
  const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientY, button });
  target.dispatchEvent(event);
};

describe('table visual click below last table', () => {
  it('moves below a trailing table when clicking under it', () => {
    const { view, widget } = mount('| a | b |\n| --- | --- |\n| 1 | 2 |');
    expect(widget).toBeDefined();
    const before = view.state.doc.toString();
    press(view.contentDOM, 50, 1);
    press(view.contentDOM, 5);
    press(widget!, 50);
    expect(view.state.doc.toString()).toBe(before);
    press(view.contentDOM, 50);
    expect(view.state.doc.toString()).toBe(before + '\n');
    view.destroy();
  });

  it('ignores clicks when the table is not last or there are no tables', () => {
    const notLast = mount('| a | b |\n| --- | --- |\n| 1 | 2 |\n\ntext after');
    press(notLast.view.contentDOM, 50);
    expect(notLast.view.state.doc.toString().endsWith('text after')).toBe(true);
    const none = mount('plain text');
    press(none.view.contentDOM, 50);
    expect(none.view.state.doc.toString()).toBe('plain text');
  });
});
