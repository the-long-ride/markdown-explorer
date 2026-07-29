import assert from 'node:assert/strict';
import test from 'node:test';

import { splitLeadingHtmlComments } from '../../ui/src/components/Content/contentUtils.ts';

test('leading rendered HTML comments are separated before Properties', () => {
  const first = '<div class="mdn-html-comment" role="note"><code>First</code></div>';
  const second = '<div class="mdn-html-comment" role="note"><code>Second</code></div>';
  const body = '<p>The rest</p>';

  assert.deepEqual(splitLeadingHtmlComments(`\n${first}\n${second}\n${body}`), {
    leadingCommentsHtml: `${first}\n${second}`,
    bodyHtml: body,
  });
});

test('ordinary body comments are not moved ahead of Properties', () => {
  const body = '<p>Intro</p><div class="mdn-html-comment" role="note"><code>Later</code></div>';

  assert.deepEqual(splitLeadingHtmlComments(body), {
    leadingCommentsHtml: '',
    bodyHtml: body,
  });
});
