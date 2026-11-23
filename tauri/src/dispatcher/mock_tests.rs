use super::*;
use std::fs;
use tauri::test::{mock_builder, mock_context, noop_assets, MockRuntime};
use tauri::{App, Emitter};
use tokio::sync::mpsc::{unbounded_channel, UnboundedReceiver};

#[path = "mock_tests/external.rs"]
mod external;
#[path = "mock_tests/updater.rs"]
mod updater;
#[path = "mock_tests/workspaces.rs"]
mod workspaces;

struct Host {
    app: App<MockRuntime>,
    state: AppState,
    events: UnboundedReceiver<Value>,
}

impl Host {
    fn new() -> Self {
        Self::build(None)
    }

    fn build(update_endpoint: Option<&str>) -> Self {
        let state = AppState::new();
        let mut context = mock_context(noop_assets());
        context.config_mut().identifier =
            format!("com.markdown-explorer.test.{}", uuid::Uuid::new_v4());
        let mut builder = mock_builder()
            .manage(state.clone())
            .manage(native::MockNativeDialogs::default());
        if let Some(endpoint) = update_endpoint {
            context.config_mut().plugins.0.insert("updater".into(), json!({
                "endpoints":[endpoint], "dangerousInsecureTransportProtocol":true, "pubkey":updater::PUBLIC_KEY
            }));
            builder = builder.plugin(
                tauri_plugin_updater::Builder::new()
                    .target("test-target")
                    .build(),
            );
        }
        let app = builder.build(context).unwrap();
        let (tx, events) = unbounded_channel();
        app.listen("host-message", move |event| {
            let _ = tx.send(serde_json::from_str(event.payload()).unwrap());
        });
        Self { app, state, events }
    }

    fn dispatcher(&self) -> Dispatcher {
        Dispatcher {
            app: self.app.handle().clone(),
            state: self.state.clone(),
        }
    }

    async fn send(&self, message: Value) {
        self.dispatcher().handle(message).await.unwrap();
    }

    async fn event(&mut self, command: &str) -> Value {
        tokio::time::timeout(Duration::from_secs(5), async {
            while let Some(payload) = self.events.recv().await {
                if payload["command"] == command {
                    return payload;
                }
            }
            panic!("host event channel closed");
        })
        .await
        .unwrap_or_else(|_| panic!("no {command} event"))
    }

    fn workspace(&self, path: &Path) {
        self.dispatcher().set_workspace(path.to_owned(), None);
    }

    fn dialog(&self, selection: Option<PathBuf>) {
        self.app
            .state::<native::MockNativeDialogs>()
            .0
            .lock()
            .unwrap()
            .push_back(selection);
    }
}

impl Drop for Host {
    fn drop(&mut self) {
        for path in [
            self.app.path().app_config_dir(),
            self.app.path().app_data_dir(),
        ]
        .into_iter()
        .flatten()
        {
            let _ = fs::remove_dir_all(path);
        }
    }
}

#[tokio::test]
async fn mounted_dispatcher_acknowledges_ready_and_ignores_duplicate() {
    let mut host = Host::new();
    Dispatcher::mount(host.app.handle(), host.state.clone());
    let request = json!({
        "command":"ready", "readyId":"one", "documentConversionEnabled": true,
        "workspaceOperationId":"operation", "workspaceTabId":"tab"
    });
    host.app.emit("webview-message", &request).unwrap();
    let ack = host.event("readyAck").await;
    assert_eq!(ack["workspaceOperationId"], "operation");
    assert_eq!(ack["workspaceTabId"], "tab");
    host.event("renderContent").await;
    assert!(host.state.inner.read().document_conversion_enabled);
    host.send(request).await;
    assert!(host.events.try_recv().is_err());
}

#[tokio::test]
async fn fresh_ready_request_emits_pending_external_open_once() {
    let mut host = Host::new();
    let window = tauri::WebviewWindowBuilder::new(&host.app, "main", tauri::WebviewUrl::default())
        .build()
        .unwrap();
    let temp = tempfile::tempdir().unwrap();
    host.state.inner.write().external_open_request =
        Some(crate::runtime::external_open::ExternalOpenRequest::Folder {
            folder_path: temp.path().to_owned(),
        });
    host.send(json!({"command":"ready","readyId":"first"}))
        .await;
    let ack = host.event("readyAck").await;
    assert_eq!(ack["isMaximized"], false);
    assert!(ack.get("workspaceOperationId").is_none());
    let open = host.event("externalOpenRequest").await;
    assert_eq!(
        open["request"],
        json!({"mode":"folder","folderPath": temp.path()})
    );
    host.event("renderContent").await;
    host.send(json!({"command":"ready","readyId":"reload"}))
        .await;
    assert_eq!(host.event("readyAck").await["appRuntime"], "tauri");
    host.event("renderContent").await;
    assert!(host.events.try_recv().is_err());
    drop(window);
}

#[tokio::test]
async fn mock_window_routes_preserve_zoom_and_close_guard_state() {
    use crate::runtime::close_guard::CloseDecision;

    let host = Host::new();
    let window = tauri::WebviewWindowBuilder::new(&host.app, "main", tauri::WebviewUrl::default())
        .build()
        .unwrap();
    for command in [
        "window-minimize",
        "window-maximize",
        "toggle-fullscreen",
        "updateAppearance",
        "unknown",
    ] {
        host.send(json!({"command":command})).await;
    }
    let close_guard = &host.state.close_guard;
    let CloseDecision::Prevent(request) = close_guard
        .lock()
        .on_close_requested(std::time::Instant::now())
    else {
        panic!("first close must be intercepted");
    };
    host.send(json!({"command":"confirmNativeClose","requestId":"stale","intent":request.intent}))
        .await;
    assert!(matches!(
        close_guard
            .lock()
            .on_close_requested(std::time::Instant::now()),
        CloseDecision::Prevent(_)
    ));
    host.send(json!({"command":"confirmNativeClose","requestId":request.request_id,"intent":request.intent})).await;
    assert!(matches!(
        close_guard
            .lock()
            .on_close_requested(std::time::Instant::now()),
        CloseDecision::Allow
    ));
    for _ in 0..20 {
        host.send(json!({"command":"zoom-in"})).await;
    }
    assert_eq!(host.state.inner.read().zoom_level, 2.0);
    host.send(json!({"command":"zoom-out"})).await;
    assert_eq!(host.state.inner.read().zoom_level, 1.8);
    host.send(json!({"command":"zoom-reset"})).await;
    assert_eq!(host.state.inner.read().zoom_level, 0.0);
    host.send(json!({"command":"window-close"})).await;
    drop(window);
}

#[tokio::test]
async fn activation_publishes_current_content_and_rejects_stale_scan_generation() {
    let workspace = tempfile::tempdir().unwrap();
    let path = workspace.path().join("note.md");
    fs::write(&path, "# Current note").unwrap();
    let mut host = Host::new();
    host.send(json!({
        "command":"activateWorkspace", "workspacePath":workspace.path(), "openFirstFile":true,
        "workspaceOperationId":"first", "workspaceTabId":"notes"
    }))
    .await;
    let event = host.event("renderContent").await;
    assert_eq!(event["markdownSource"], "# Current note");
    assert_eq!(event["workspaceOperationId"], "first");
    assert!(event["documentWrite"]["revision"].is_string());
    let generation = host.state.inner.read().workspace_scan_generation;
    host.send(json!({"command":"cancelWorkspaceScan","workspaceOperationId":"other"}))
        .await;
    assert_eq!(
        host.state.inner.read().workspace_scan_generation,
        generation
    );
    host.send(json!({"command":"cancelWorkspaceScan","workspaceOperationId":"first"}))
        .await;
    assert_ne!(
        host.state.inner.read().workspace_scan_generation,
        generation
    );
    let operation =
        host_message::WorkspaceOperationMetadata::from_parts(Some("first"), Some("notes"));
    host.dispatcher()
        .send_initial_content_for_scan(true, workspace.path(), generation, operation.as_ref())
        .await;
    while let Ok(event) = host.events.try_recv() {
        assert_ne!(event["command"], "renderContent");
    }
    host.send(json!({"command":"navigate","path":"missing.md"}))
        .await;
    host.event("navNotFound").await;
    host.send(json!({"command":"navigate","path":""})).await;
    host.event("renderContent").await;
    assert!(host.state.inner.read().current_file.is_none());
    host.send(json!({"command":"closeWorkspace"})).await;
    host.event("readyAck").await;
    assert!(host.state.inner.read().workspace_path.is_none());
}

#[tokio::test]
async fn search_dispatch_reads_only_indexed_previews() {
    let temp = tempfile::tempdir().unwrap();
    let note = temp.path().join("note.md");
    fs::write(&note, "# Needle").unwrap();
    let mut host = Host::new();
    host.workspace(temp.path());
    let preview = json!({"command":"loadSearchPreview","requestId":"p","filePath":note});
    host.send(preview.clone()).await;
    assert_eq!(
        host.event("searchPreviewResult").await["reason"],
        "outside-workspace"
    );
    let items = json!([{"fsPath":note,"fileName":"note.md","title":"Needle","tabId":"notes"}]);
    host.send(json!({"command":"indexWorkspaceSearchItems","items":items}))
        .await;
    host.send(preview.clone()).await;
    assert_eq!(
        host.event("searchPreviewResult").await["markdownSource"],
        "# Needle"
    );
    host.send(
        json!({"command":"searchWorkspace","requestId":"find","query":"Needle","items":items}),
    )
    .await;
    assert_eq!(
        host.event("workspaceSearchResults").await["requestId"],
        "find"
    );
    let done = host.event("workspaceSearchResults").await;
    assert_eq!(done["done"], true);
    assert_eq!(done["total"], 1);
    host.send(json!({
        "command":"searchAcrossWorkspaces","requestId":"across","query":"Needle",
        "tabIds":["notes"],"matchCase":true
    }))
    .await;
    let batch = host.event("crossTabSearchResults").await;
    assert_eq!(batch["requestId"], "across");
    assert_eq!(batch["done"], false);
    assert_eq!(batch["results"].as_array().unwrap().len(), 1);
    assert_eq!(host.event("crossTabSearchResults").await["done"], true);
    host.send(json!({"command":"loadWorkspaceSearchIndexes","tabs":[
        {"tabId":"notes","workspacePath":temp.path()}, {"tabId":"missing","workspacePath":temp.path().join("absent")}
    ]})).await;
    assert_eq!(
        host.event("workspaceSearchIndexLoaded").await["tabs"][0]["tabId"],
        "notes"
    );
    assert_eq!(
        host.event("workspaceSearchIndexLoaded").await["tabs"][0]["tabId"],
        "missing"
    );
}

#[tokio::test]
async fn document_and_git_routes_reply_with_failure_and_success_metadata() {
    let temp = tempfile::tempdir().unwrap();
    let note = temp.path().join("note.md");
    fs::write(&note, "# Original").unwrap();
    let mut host = Host::new();
    host.send(json!({"command":"saveDocument","filePath":note}))
        .await;
    assert_eq!(
        host.event("saveDocumentResult").await["reason"],
        "read-only"
    );
    host.workspace(temp.path());
    host.send(
        json!({"command":"saveDocument","requestId":"stale","filePath":note,
        "source":"new", "expectedRevision":"old"}),
    )
    .await;
    let conflict = host.event("saveDocumentResult").await;
    assert_eq!(conflict["requestId"], "stale");
    assert_eq!(conflict["reason"], "conflict");
    assert_eq!(conflict["diskSource"], "# Original");
    host.send(
        json!({"command":"saveDocument","filePath":note,"source":"new",
        "expectedRevision":conflict["diskRevision"]}),
    )
    .await;
    assert_eq!(host.event("saveDocumentResult").await["ok"], true);
    assert_eq!(fs::read_to_string(&note).unwrap(), "new");
    host.send(json!({"command":"listDocumentHistory","requestId":"git","filePath":note}))
        .await;
    let history = host.event("documentHistoryResult").await;
    assert_eq!(history["requestId"], "git");
    assert_eq!(history["ok"], false);
    assert_eq!(history["revisions"], json!([]));
}
