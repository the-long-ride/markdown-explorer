pub fn electron_api_shim_js() -> &'static str {
    r#"
(function () {
  if (window.electronAPI) return;
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  // Block hard-reload shortcuts (Ctrl+R, Ctrl+Shift+R, Ctrl+F5) that would
  // crash the Tauri app by reloading the webview without re-injecting the
  // preload bridge or Tauri globals.
  document.addEventListener('keydown', function (e) {
    var ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl) return;
    var k = e.key;
    if (k === 'r' || k === 'R' || k === 'F5') {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);
  const listeners = new Set();
  let unlistenHost = null;
  let dropListenerStarted = false;
  let unlistenDrop = null;
  let droppedPaths = [];
  let tauriFullscreenDragLocked = false;

  function applyTauriFullscreenDragLock(root) {
    var nodes = [];
    if (root && root.nodeType === 1) nodes.push(root);
    if (root && root.querySelectorAll) {
      var matches = root.querySelectorAll('[data-tauri-drag-region], [data-tauri-drag-region-disabled]');
      for (var i = 0; i < matches.length; i++) nodes.push(matches[i]);
    }

    for (var j = 0; j < nodes.length; j++) {
      var el = nodes[j];
      if (!el || !el.getAttribute) continue;
      var hasDragRegion = el.getAttribute('data-tauri-drag-region') !== null;
      var disabledValue = el.getAttribute('data-tauri-drag-region-disabled');
      if (tauriFullscreenDragLocked && hasDragRegion) {
        el.setAttribute('data-tauri-drag-region-disabled', el.getAttribute('data-tauri-drag-region') || '');
        el.removeAttribute('data-tauri-drag-region');
      } else if (!tauriFullscreenDragLocked && disabledValue !== null) {
        el.setAttribute('data-tauri-drag-region', disabledValue);
        el.removeAttribute('data-tauri-drag-region-disabled');
      }
    }
  }

  function setTauriFullscreenDragLocked(locked) {
    tauriFullscreenDragLocked = Boolean(locked);
    applyTauriFullscreenDragLock(document);
  }

  document.addEventListener('mousedown', function (e) {
    if (!tauriFullscreenDragLocked || e.button !== 0) return;
    var path = e.composedPath ? e.composedPath() : [];
    for (var i = 0; i < path.length; i++) {
      var el = path[i];
      if (el && el.getAttribute && el.getAttribute('data-tauri-drag-region') !== null) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
    }
  }, true);

  function dispatchTauriFileDropState(type, paths) {
    window.dispatchEvent(new CustomEvent('markdown-explorer-tauri-file-drop-state', {
      detail: { type: type, paths: Array.isArray(paths) ? paths.slice() : [] }
    }));
  }

  function ensureHostListener() {
    if (unlistenHost) return;
    if (!window.__TAURI__ || !window.__TAURI__.event) {
      setTimeout(ensureHostListener, 50);
      return;
    }
    const dereg = window.__TAURI__.event.listen('host-message', function (e) {
      const payload = e && e.payload;
      if (!payload) return;
      if (payload.command === 'fullscreenChanged') {
        setTauriFullscreenDragLocked(payload.isFullscreen);
      }
      listeners.forEach(function (cb) { try { cb(payload); } catch (err) { console.error('host-message listener threw:', err); } });
    });
    if (dereg && typeof dereg.then === 'function') {
      dereg.then(function (fn) { unlistenHost = fn; });
    } else {
      unlistenHost = dereg;
    }
  }

  function ensureDropListener() {
    if (dropListenerStarted || unlistenDrop) return;
    if (!window.__TAURI__) {
      setTimeout(ensureDropListener, 50);
      return;
    }

    var webview = window.__TAURI__.webview;
    var webviewWindow = window.__TAURI__.webviewWindow;
    var windowApi = window.__TAURI__.window;
    var currentWebview = webview && typeof webview.getCurrentWebview === 'function'
      ? webview.getCurrentWebview()
      : webviewWindow && typeof webviewWindow.getCurrentWebviewWindow === 'function'
        ? webviewWindow.getCurrentWebviewWindow()
        : windowApi && typeof windowApi.getCurrentWindow === 'function'
          ? windowApi.getCurrentWindow()
          : null;
    if (currentWebview && typeof currentWebview.onDragDropEvent === 'function') {
      dropListenerStarted = true;
      var dereg = currentWebview.onDragDropEvent(function (e) {
        var payload = e && e.payload;
        if (payload && payload.type === 'over') {
          dispatchTauriFileDropState('over');
        } else if (payload && payload.type === 'drop' && Array.isArray(payload.paths)) {
          droppedPaths = payload.paths.slice();
          dispatchTauriFileDropState('drop', droppedPaths);
          window.dispatchEvent(new CustomEvent('markdown-explorer-tauri-file-drop', { detail: droppedPaths.slice() }));
        } else if (payload && (payload.type === 'cancel' || payload.type === 'leave')) {
          droppedPaths = [];
          dispatchTauriFileDropState(payload.type);
        }
      });
      if (dereg && typeof dereg.then === 'function') {
        dereg.then(function (fn) { unlistenDrop = fn; });
      } else {
        unlistenDrop = dereg;
      }
      return;
    }

    if (!window.__TAURI__.event || typeof window.__TAURI__.event.listen !== 'function') {
      setTimeout(ensureDropListener, 50);
      return;
    }
    dropListenerStarted = true;
    window.__TAURI__.event.listen('tauri://drag-enter', function () {
      dispatchTauriFileDropState('over');
    });
    window.__TAURI__.event.listen('tauri://drag-leave', function () {
      dispatchTauriFileDropState('leave');
    });
    window.__TAURI__.event.listen('tauri://file-drop', function (e) {
      var paths = e && e.payload;
      droppedPaths = Array.isArray(paths) ? paths.slice() : [];
      if (droppedPaths.length) {
        dispatchTauriFileDropState('drop', droppedPaths);
        window.dispatchEvent(new CustomEvent('markdown-explorer-tauri-file-drop', { detail: droppedPaths.slice() }));
      }
    }).then(function (fn) { unlistenDrop = fn; });
  }

  window.electronAPI = {
    postMessage: function (msg) {
      if (!window.__TAURI__ || !window.__TAURI__.event) {
        setTimeout(function () { window.electronAPI.postMessage(msg); }, 50);
        return;
      }
      try {
        window.__TAURI__.event.emit('webview-message', msg);
      } catch (err) {
        console.error('electronAPI.postMessage failed:', err);
      }
    },
    onMessage: function (cb) {
      ensureHostListener();
      listeners.add(cb);
      return function () {
        listeners.delete(cb);
        if (listeners.size === 0 && unlistenHost) {
          try { unlistenHost(); } catch (e) {}
          unlistenHost = null;
        }
      };
    },
    getPathForFile: function (file) {
      return file && file.path;
    },
    consumeDroppedPaths: function () {
      ensureDropListener();
      var paths = droppedPaths.slice();
      droppedPaths = [];
      return paths;
    }
  };
  ensureDropListener();

  function fileSrcToAsset(url) {
    if (!url || typeof url !== 'string') return url;
    if (!url.startsWith('file:///')) return url;
    var path = url.replace('file:///', '');
    var encoded = encodeURIComponent(path).replace(/%2F/g, '/');
    return 'local-file://' + encoded;
  }

  function patchSrc(el) {
    if (!el || !el.tagName) return;
    var tag = el.tagName.toLowerCase();
    // Note: <a> is intentionally NOT rewritten here. Rewriting anchor href to
    // local-file:// would let a click navigate the whole webview to the file's
    // raw bytes. Anchors are handled by the click guard in startObserver.
    if (tag !== 'img' && tag !== 'video' && tag !== 'source' && tag !== 'track' && tag !== 'link') return;
    var src = el.getAttribute('src');
    if (src && src.startsWith('file:///')) {
      el.setAttribute('src', fileSrcToAsset(src));
    }
    var href = el.getAttribute('href');
    if (tag !== 'a' && href && href.startsWith('file:///')) {
      el.setAttribute('href', fileSrcToAsset(href));
    }
    if (tag === 'video') {
      var poster = el.getAttribute('poster');
      if (poster && poster.startsWith('file:///')) {
        el.setAttribute('poster', fileSrcToAsset(poster));
      }
    }
  }

 function startObserver() {
    if (!document.documentElement) {
      setTimeout(startObserver, 10);
      return;
    }
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        for (var j = 0; j < m.addedNodes.length; j++) {
          var node = m.addedNodes[j];
          if (node.nodeType === 1) {
            patchSrc(node);
            applyTauriFullscreenDragLock(node);
            if (node.querySelectorAll) {
              var els = node.querySelectorAll('img,video,source,track,link');
              for (var k = 0; k < els.length; k++) {
                patchSrc(els[k]);
              }
            }
          }
        }
        if (m.type === 'attributes' && (m.attributeName === 'src' || m.attributeName === 'href')) {
          patchSrc(m.target);
        }
        if (m.type === 'attributes' && m.attributeName === 'data-tauri-drag-region') {
          applyTauriFullscreenDragLock(m.target);
        }
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'poster', 'href', 'data-tauri-drag-region']
    });

    // Guard anchor clicks that point at local files: never let them navigate
    // the webview to file:/// or local-file:// (which would replace the app
    // with the file's raw bytes). Let the host decide via a custom attribute
    // if opening is desired.
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.tagName) return;
      var a = t.tagName.toLowerCase() === 'a' ? t : (t.closest && t.closest('a'));
      if (!a) return;
      var href = a.getAttribute('href');
      if (!href) return;
      if (href.indexOf('file:///') === 0 || href.indexOf('local-file://') === 0) {
        e.preventDefault();
      }
    }, true);
  }
  startObserver();
})();
"#
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_electron_api_shim_js_contains_reload_prevention() {
        let js = electron_api_shim_js();
        assert!(js.contains("Block hard-reload shortcuts"));
        assert!(js.contains("e.preventDefault()"));
        assert!(js.contains("e.stopImmediatePropagation()"));
        assert!(js.contains("'r' || k === 'R' || k === 'F5'"));
    }

    #[test]
    fn test_electron_api_shim_js_contains_drag_drop_bridge() {
        let js = electron_api_shim_js();
        assert!(js.contains("onDragDropEvent"));
        assert!(js.contains("getCurrentWebview"));
        assert!(js.contains("getCurrentWebviewWindow"));
        assert!(js.contains("getCurrentWindow"));
        assert!(js.contains("payload.paths"));
        assert!(js.contains("dispatchTauriFileDropState"));
        assert!(js.contains("markdown-explorer-tauri-file-drop-state"));
        assert!(js.contains("consumeDroppedPaths"));
        assert!(js.contains("markdown-explorer-tauri-file-drop"));
        assert!(js.contains("tauri://drag-enter"));
        assert!(js.contains("tauri://drag-leave"));
        assert!(js.contains("tauri://file-drop"));
    }
}
