const DEFAULT_RESPONSE_TIMEOUT_MS = 10000;

function createNativeCloseGuard({
  app,
  dialog,
  getMainWindow,
  sendHostMessage,
  platform = process.platform,
  responseTimeoutMs = DEFAULT_RESPONSE_TIMEOUT_MS,
} = {}) {
  let pendingRequest = null;
  // Intents the renderer may still answer with; an upgraded window->app request keeps accepting the original intent.
  let acceptedIntents = new Set();
  let pendingStale = false;
  let pendingTimer = null;
  let nativePromptOpen = false;
  let rendererGone = false;
  let requestCounter = 0;
  let allowNextWindowClose = false;
  let allowAppQuit = false;

  function nextRequestId() {
    requestCounter += 1;
    return `native-close-${requestCounter}`;
  }

  function clearPending() {
    pendingRequest = null;
    acceptedIntents = new Set();
    pendingStale = false;
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
  }

  function approve(intent) {
    clearPending();
    if (intent === 'app') {
      allowAppQuit = true;
      app?.quit?.();
      return true;
    }
    allowNextWindowClose = true;
    getMainWindow?.()?.close?.();
    return true;
  }

  // The renderer cannot answer when its process is gone, destroyed or has not mounted the guard bridge yet.
  function isRendererUnavailable(mainWindow) {
    const contents = mainWindow?.webContents;
    if (!contents) return false;
    if (rendererGone) return true;
    try {
      return Boolean(contents.isDestroyed?.() || contents.isCrashed?.() || contents.isLoading?.());
    } catch {
      return true;
    }
  }

  function startPendingTimer() {
    if (!(responseTimeoutMs > 0)) return;
    pendingTimer = setTimeout(() => {
      pendingTimer = null;
      if (pendingRequest) pendingStale = true;
    }, responseTimeoutMs);
    pendingTimer.unref?.();
  }

  async function askNatively() {
    if (nativePromptOpen || !pendingRequest) return;
    if (typeof dialog?.showMessageBox !== 'function') {
      approve(pendingRequest.intent);
      return;
    }
    const request = pendingRequest;
    nativePromptOpen = true;
    let response = 1;
    try {
      const parent = getMainWindow?.();
      const options = {
        type: 'warning',
        buttons: ['Quit', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
        title: 'Markdown Explorer',
        message: 'Markdown Explorer is not responding to the close request.',
        detail: 'Unsaved changes may be lost if you quit now.',
      };
      ({ response } = await (parent ? dialog.showMessageBox(parent, options) : dialog.showMessageBox(options)));
    } catch {
      response = 0;
    }
    nativePromptOpen = false;
    if (pendingRequest !== request) return;
    if (response === 0) approve(request.intent);
    else clearPending();
  }

  function request(intent, { resend = true } = {}) {
    const mainWindow = getMainWindow?.();
    if (!mainWindow) {
      if (intent === 'app') {
        clearPending();
        allowAppQuit = true;
        app?.quit?.();
      }
      return null;
    }
    if (isRendererUnavailable(mainWindow)) {
      approve(pendingRequest?.intent === 'app' ? 'app' : intent);
      return null;
    }
    if (pendingRequest) {
      // Cmd+Q while a window close is pending must quit the app once the renderer approves.
      const upgraded = intent === 'app' && pendingRequest.intent !== 'app';
      if (upgraded) {
        pendingRequest = { ...pendingRequest, intent: 'app' };
        acceptedIntents.add('app');
      }
      if (!resend && !upgraded) return pendingRequest;
      if (pendingStale && !upgraded) {
        askNatively();
        return pendingRequest;
      }
      sendHostMessage?.(pendingRequest);
      return pendingRequest;
    }
    pendingRequest = {
      command: 'nativeCloseRequested',
      requestId: nextRequestId(),
      intent,
    };
    acceptedIntents = new Set([intent]);
    startPendingTimer();
    sendHostMessage?.(pendingRequest);
    return pendingRequest;
  }

  function attachWindow(window) {
    window?.on?.('close', (event) => {
      if (allowAppQuit) return;
      if (allowNextWindowClose) {
        allowNextWindowClose = false;
        return;
      }
      event?.preventDefault?.();
      request(platform === 'darwin' ? 'window' : 'app');
    });

    // A hung renderer never answers, so ask natively instead of deadlocking the close.
    window?.on?.('unresponsive', () => {
      if (pendingRequest) askNatively();
    });

    const contents = window?.webContents;
    contents?.on?.('render-process-gone', () => {
      rendererGone = true;
      if (pendingRequest) approve(pendingRequest.intent);
    });
    contents?.on?.('did-finish-load', () => {
      rendererGone = false;
    });
    contents?.on?.('did-start-navigation', (details, ...legacy) => {
      const isMainFrame = typeof details?.isMainFrame === 'boolean' ? details.isMainFrame : legacy[1] === true;
      const isSameDocument = typeof details?.isSameDocument === 'boolean' ? details.isSameDocument : legacy[0] === true;
      // A reloaded renderer forgets the request it was asked to answer.
      if (isMainFrame && !isSameDocument) clearPending();
    });
  }

  function requestAppQuit() {
    return request('app', { resend: false });
  }

  function requestWindowClose() {
    return request(platform === 'darwin' ? 'window' : 'app');
  }

  function handleBeforeQuit(event) {
    if (!event || allowAppQuit) return true;
    event.preventDefault?.();
    request('app');
    return false;
  }

  function matchesPending(message) {
    return Boolean(pendingRequest && message
      && message.requestId === pendingRequest.requestId
      && acceptedIntents.has(message.intent));
  }

  function cancel(message) {
    if (!matchesPending(message)) return false;
    clearPending();
    return true;
  }

  function confirm(message) {
    if (message?.cancelled === true) return cancel(message);
    if (!matchesPending(message)) return false;
    return approve(pendingRequest.intent);
  }

  function isAppQuitApproved() {
    return allowAppQuit;
  }

  return {
    attachWindow,
    requestAppQuit,
    requestWindowClose,
    handleBeforeQuit,
    confirm,
    cancel,
    isAppQuitApproved,
  };
}

module.exports = { createNativeCloseGuard };
