import assert from 'node:assert/strict';
import test from 'node:test';

const originalWindow = globalThis.window;
globalThis.window = new EventTarget();
const {
  CONTENT_TAB_CLOSE_REQUEST_EVENT,
  requestAnimatedContentTabClose,
} = await import('../../ui/src/components/Content/contentTabCloseEvents.ts');

test.after(() => {
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
});

test('content-tab close request reports no animation handler when tabs are hidden', () => {
  assert.equal(requestAnimatedContentTabClose({ action: 'closeAllTabs' }), false);
});

test('content-tab close request reports an animation handler when the tabs component consumes it', () => {
  const consume = (event) => event.preventDefault();
  window.addEventListener(CONTENT_TAB_CLOSE_REQUEST_EVENT, consume, { once: true });
  assert.equal(requestAnimatedContentTabClose({ action: 'closeAllTabs' }), true);
});
