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

  function ensureHostListener() {
    if (unlistenHost) return;
    if (!window.__TAURI__ || !window.__TAURI__.event) {
      setTimeout(ensureHostListener, 50);
      return;
    }
    const dereg = window.__TAURI__.event.listen('host-message', function (e) {
      const payload = e && e.payload;
      if (!payload) return;
      listeners.forEach(function (cb) { try { cb(payload); } catch (err) { console.error('host-message listener threw:', err); } });
    });
    if (dereg && typeof dereg.then === 'function') {
      dereg.then(function (fn) { unlistenHost = fn; });
    } else {
      unlistenHost = dereg;
    }
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
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'poster', 'href']
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
}
