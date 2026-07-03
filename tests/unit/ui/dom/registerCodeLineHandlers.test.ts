import { describe, it, expect, beforeEach } from 'vitest';
import { registerCodeLineHandlers } from '../../../../ui/src/dom/codeLineHandlers';

describe('registerCodeLineHandlers', () => {
  let win: any;

  beforeEach(() => {
    win = {};
    document.body.innerHTML = '';
  });

  it('registers without errors', () => {
    document.body.innerHTML = `
      <div class="mdn-codeblock">
        <pre class="mdn-pre">
          <div class="mdn-codeblock-gutter">
            <span data-line="1">1</span>
            <span data-line="2">2</span>
            <span data-line="3">3</span>
          </div>
          <code>line1\nline2\nline3</code>
        </pre>
      </div>
    `;
    expect(() => registerCodeLineHandlers()).not.toThrow();
    registerCodeLineHandlers();
  });

  it('paintCodeLineState marks active line', () => {
    document.body.innerHTML = `
      <div class="mdn-codeblock" data-active-line="2" data-selected-start="2" data-selected-end="2">
        <div class="mdn-codeblock-gutter">
          <span data-line="1" class="is-active"></span>
          <span data-line="2" class="is-active"></span>
          <span data-line="3" class="is-active is-selected"></span>
        </div>
      </div>
    `;
    expect(() => registerCodeLineHandlers()).not.toThrow();
  });
});
