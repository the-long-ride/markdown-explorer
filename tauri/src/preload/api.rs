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
  const pendingHostMessages = [];
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

  function dispatchHostMessage(payload) {
    if (!payload || typeof payload !== 'object') return;
    if (payload.command === 'fullscreenChanged') {
      setTauriFullscreenDragLocked(payload.isFullscreen);
    }
    if (listeners.size === 0) {
      pendingHostMessages.push(payload);
      if (pendingHostMessages.length > 100) pendingHostMessages.shift();
      return;
    }
    listeners.forEach(function (cb) {
      try { cb(payload); } catch (err) { console.error('host-message listener threw:', err); }
    });
  }

  window.__markdownExplorerHandleHostMessage = dispatchHostMessage;

  window.__markdownExplorerHandleNativeDrop = function (event) {
    var detail = event && typeof event === 'object' ? event : {};
    var type = typeof detail.type === 'string' ? detail.type : '';
    var paths = Array.isArray(detail.paths) ? detail.paths.slice() : [];

    if (type === 'over' || type === 'enter') {
      dispatchTauriFileDropState('over', paths);
      return;
    }
    if (type === 'drop') {
      droppedPaths = paths;
      dispatchTauriFileDropState('drop', droppedPaths);
      if (droppedPaths.length) {
        window.dispatchEvent(new CustomEvent('markdown-explorer-tauri-file-drop', {
          detail: droppedPaths.slice()
        }));
      }
      return;
    }
    if (type === 'cancel' || type === 'leave') {
      droppedPaths = [];
      dispatchTauriFileDropState(type);
    }
  };

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
      const wasEmpty = listeners.size === 0;
      listeners.add(cb);
      if (wasEmpty && pendingHostMessages.length > 0) {
        const queued = pendingHostMessages.splice(0, pendingHostMessages.length);
        queued.forEach(dispatchHostMessage);
      }
      return function () {
        listeners.delete(cb);
      };
    },
    getPathForFile: function (file) {
      return file && file.path;
    },
    consumeDroppedPaths: function () {
      var paths = droppedPaths.slice();
      droppedPaths = [];
      return paths;
    }
  };

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
    fn test_electron_api_shim_js_contains_native_drag_drop_bridge() {
        let js = electron_api_shim_js();
        assert!(js.contains("__markdownExplorerHandleNativeDrop"));
        assert!(js.contains("dispatchTauriFileDropState"));
        assert!(js.contains("markdown-explorer-tauri-file-drop-state"));
        assert!(js.contains("consumeDroppedPaths"));
        assert!(js.contains("markdown-explorer-tauri-file-drop"));
        assert!(!js.contains("onDragDropEvent"));
        assert!(!js.contains("tauri://drag-enter"));
    }

    #[test]
    fn test_electron_api_shim_uses_native_host_message_bridge() {
        let js = electron_api_shim_js();
        assert!(js.contains("__markdownExplorerHandleHostMessage"));
        assert!(js.contains("pendingHostMessages"));
        assert!(js.contains("queued.forEach(dispatchHostMessage)"));
        let legacy_listener = ["__TAURI__", ".event.listen"].concat();
        assert!(!js.contains(&legacy_listener));
        assert!(!js.contains("hostListenerPromise"));
    }
}
