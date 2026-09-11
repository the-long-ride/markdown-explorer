function createNativeCloseGuard({ app, getMainWindow, sendHostMessage, platform = process.platform } = {}) {
  let pendingRequest = null;
  let requestCounter = 0;
  let allowNextWindowClose = false;
  let allowAppQuit = false;

  function nextRequestId() {
    requestCounter += 1;
    return `native-close-${requestCounter}`;
  }

  function request(intent) {
    if (pendingRequest) return pendingRequest;
    const mainWindow = getMainWindow?.();
    if (!mainWindow) {
      if (intent === 'app') {
        allowAppQuit = true;
        app?.quit?.();
      }
      return null;
    }
    pendingRequest = {
      command: 'nativeCloseRequested',
      requestId: nextRequestId(),
      intent,
    };
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
  }

  function requestAppQuit() {
    return request('app');
  }

  function handleBeforeQuit(event) {
    if (!event || allowAppQuit) return true;
    event.preventDefault?.();
    request('app');
    return false;
  }

  function cancel(message) {
    if (!pendingRequest) return false;
    if (!message || message.requestId !== pendingRequest.requestId || message.intent !== pendingRequest.intent) return false;
    pendingRequest = null;
    return true;
  }

  function confirm(message) {
    if (message?.cancelled === true) return cancel(message);
    if (!pendingRequest) return false;
    if (!message || message.requestId !== pendingRequest.requestId || message.intent !== pendingRequest.intent) return false;
    const intent = pendingRequest.intent;
    pendingRequest = null;
    if (intent === 'app') {
      allowAppQuit = true;
      app?.quit?.();
      return true;
    }
    allowNextWindowClose = true;
    getMainWindow?.()?.close?.();
    return true;
  }

  function closeApprovedWindow() {
    const mainWindow = getMainWindow?.();
    if (!mainWindow) return false;
    pendingRequest = null;
    if (platform === 'darwin') allowNextWindowClose = true;
    else allowAppQuit = true;
    mainWindow.close?.();
    return true;
  }

  function isAppQuitApproved() {
    return allowAppQuit;
  }

  return {
    attachWindow,
    requestAppQuit,
    handleBeforeQuit,
    confirm,
    cancel,
    closeApprovedWindow,
    isAppQuitApproved,
  };
}

module.exports = { createNativeCloseGuard };
