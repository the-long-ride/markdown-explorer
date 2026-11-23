use super::*;

#[tokio::test]
async fn workspace_picker_routes_keep_scope_and_handle_missing_and_supported_paths() {
    let temp = tempfile::tempdir().unwrap();
    let note = temp.path().join("note.md");
    let unsupported = temp.path().join("image.png");
    fs::write(&note, "# Note").unwrap();
    fs::write(&unsupported, "").unwrap();
    let mut host = Host::new();
    host.send(
        json!({"command":"openFolder","workspaceOperationId":"cancel","workspaceTabId":"tab"}),
    )
    .await;
    assert_eq!(
        host.event("workspaceOpenCancelled").await["workspaceOperationId"],
        "cancel"
    );
    assert!(host.state.inner.read().workspace_operation_id.is_none());
    host.send(json!({"command":"openPath","path":temp.path().join("missing")}))
        .await;
    assert_eq!(
        host.event("workspaceUnavailable").await["reason"],
        "missing"
    );
    host.send(json!({"command":"activateWorkspace","workspacePath":temp.path().join("missing")}))
        .await;
    assert_eq!(
        host.event("workspaceUnavailable").await["reason"],
        "missing"
    );
    host.send(json!({"command":"openPath","path":unsupported}))
        .await;
    assert!(host.state.inner.read().workspace_path.is_none());
    host.send(json!({"command":"replaceRecentWorkspaces",
        "recentWorkspaces":[{"workspacePath":temp.path(),"filePath":note}]}))
        .await;
    host.event("recentWorkspacesChanged").await;
    host.send(json!({"command":"deleteRecentWorkspace", "path":temp.path()}))
        .await;
    host.event("recentWorkspacesChanged").await;
    host.dialog(Some(temp.path().to_owned()));
    host.send(
        json!({"command":"openFolder","replaceRecentWorkspacePath":temp.path().join("old"),
        "openFirstFile":true}),
    )
    .await;
    assert_eq!(
        host.event("renderContent").await["markdownSource"],
        "# Note"
    );
    host.dialog(Some(note.clone()));
    host.send(json!({"command":"openFile"})).await;
    assert_eq!(host.event("renderContent").await["filePath"], json!(note));
    host.send(json!({"command":"openRecentWorkspace","path":note}))
        .await;
    host.event("renderContent").await;
    host.send(json!({"command":"confirmOpenPath","path":note}))
        .await;
    host.event("renderContent").await;
    host.send(json!({"command":"cancelAllWorkspaceScans"}))
        .await;
    assert!(matches!(
        host.state.inner.read().runtime_state,
        RuntimeState::Ready
    ));
    host.send(json!({"command":"refresh"})).await;
    host.event("renderContent").await;
    host.send(json!({"command":"setDocumentConversion","enabled":true}))
        .await;
    host.event("renderContent").await;
    host.send(json!({"command":"setDocumentConversion","enabled":false}))
        .await;
    host.event("renderContent").await;
    assert!(!host.state.inner.read().document_conversion_enabled);
    host.send(json!({"command":"closeWorkspace"})).await;
    host.event("readyAck").await;
}

#[tokio::test]
async fn insights_dispatch_reports_results_for_available_and_missing_workspaces() {
    let temp = tempfile::tempdir().unwrap();
    let note = temp.path().join("note.md");
    fs::write(&note, "# Insights").unwrap();
    fs::write(temp.path().join("diagram.css"), "body {}").unwrap();
    let mut host = Host::new();
    for (command, event, key, expected) in [
        (
            "scanInsightsWorkspace",
            "insightsScanComplete",
            "totalEntries",
            json!(0),
        ),
        (
            "readInsightsDocumentSource",
            "insightsDocumentSourceResult",
            "status",
            json!("missing"),
        ),
        (
            "probeWorkspaceResource",
            "workspaceResourceProbeResult",
            "status",
            json!("missing"),
        ),
        (
            "setInsightsWatchState",
            "insightsRuntimeCapabilities",
            "capabilities",
            json!({"fileChanges":"unsupported", "externalLinkChecking":true, "documentPreviewReuse":true}),
        ),
    ] {
        host.send(json!({"command":command, "requestId":"no-workspace"}))
            .await;
        assert_eq!(host.event(event).await[key], expected);
    }
    host.workspace(temp.path());
    host.send(json!({"command":"cancelInsightsScan","requestId":"scan"}))
        .await;
    assert!(host
        .state
        .inner
        .read()
        .insights_cancelled_scans
        .contains("scan"));
    host.send(
        json!({"command":"scanInsightsWorkspace","requestId":"scan","userPatterns":["*.css"]}),
    )
    .await;
    let batch = host.event("insightsScanBatch").await;
    assert_eq!(batch["entries"][0]["relativePath"], "note.md");
    let complete = host.event("insightsScanComplete").await;
    assert_eq!(complete["totalEntries"], 1);
    assert_eq!(complete["cancelled"], false);
    host.send(
        json!({"command":"readInsightsDocumentSource","requestId":"read","relativePath":"note.md",
        "softLimitBytes":4096,"hardLimitBytes":8192}),
    )
    .await;
    assert_eq!(
        host.event("insightsDocumentSourceResult").await["status"],
        "ok"
    );
    host.send(
        json!({"command":"probeWorkspaceResource","requestId":"probe","documentPath":note,
        "resourcePath":"diagram.css"}),
    )
    .await;
    assert_eq!(
        host.event("workspaceResourceProbeResult").await["status"],
        "exists"
    );
    host.send(json!({"command":"setInsightsWatchState","requestId":"watch","active":true}))
        .await;
    assert_eq!(
        host.event("insightsRuntimeCapabilities").await["capabilities"]["fileChanges"],
        "native"
    );
    assert!(host.state.inner.read().insights_watch_controller.is_some());
    fs::write(&note, "# Changed").unwrap();
    assert_eq!(
        host.event("insightsFsDelta").await["deltas"][0]["kind"],
        "update"
    );
    host.send(json!({"command":"setInsightsWatchState","active":false}))
        .await;
    assert!(host.state.inner.read().insights_watch_controller.is_none());
}

#[tokio::test]
async fn external_link_dispatch_deduplicates_results_and_looks_up_request_id() {
    let mut host = Host::new();
    host.send(json!({"command":"cancelExternalLinkChecks","requestId":"links"}))
        .await;
    assert!(host
        .state
        .inner
        .read()
        .insights_cancelled_external_checks
        .contains("links"));
    host.send(json!({
        "command":"checkExternalLinks","requestId":"links","timeoutMs":100,
        "approvedPrivateOrigins":["http://localhost"],
        "urls":["ftp://example.org/file","ftp://example.org/file"]
    }))
    .await;
    let check = host.event("externalLinkCheckResult").await;
    assert_eq!(check["requestId"], "links");
    assert_eq!(check["url"], "ftp://example.org/file");
    assert_eq!(
        host.event("externalLinkCheckComplete").await["cancelled"],
        false
    );
    assert!(host.events.try_recv().is_err());
}

#[tokio::test]
async fn workspace_entry_dispatch_updates_current_path_and_refreshes_file_list() {
    let temp = tempfile::tempdir().unwrap();
    let mut host = Host::new();
    host.workspace(temp.path());
    host.send(json!({"command":"createWorkspaceEntry","name":"note.md","kind":"file"}))
        .await;
    assert_eq!(host.event("createWorkspaceEntryResult").await["ok"], true);
    let note = temp.path().join("note.md");
    host.send(json!({"command":"navigate","path":note})).await;
    host.event("renderContent").await;
    host.send(json!({"command":"renameWorkspaceEntry","path":"note.md","name":"renamed.md","kind":"file"})).await;
    let renamed = temp.path().join("renamed.md");
    assert_eq!(host.event("renameWorkspaceEntryResult").await["ok"], true);
    assert_eq!(
        host.state.inner.read().current_file.as_deref(),
        Some(renamed.as_path())
    );
    host.send(json!({"command":"deleteWorkspaceEntries","paths":["renamed.md","absent.md"],"mode":"permanent"})).await;
    let event = host.event("deleteWorkspaceEntriesResult").await;
    assert_eq!(event["deleted"], json!(["renamed.md"]));
    assert_eq!(event["failed"][0]["path"], "absent.md");
    assert!(!renamed.exists());
    host.send(json!({"command":"renameWorkspaceEntry","path":"removed.md","name":"other.md","kind":"file"})).await;
    assert_eq!(host.event("renameWorkspaceEntryResult").await["ok"], false);
    host.send(json!({"command":"createWorkspaceEntry","name":"../outside","kind":"file"}))
        .await;
    assert_eq!(host.event("createWorkspaceEntryResult").await["ok"], false);
}

#[tokio::test]
async fn watch_refresh_notifies_for_current_file_but_not_for_ignored_paths() {
    let temp = tempfile::tempdir().unwrap();
    let note = temp.path().join("note.md");
    fs::write(&note, "# Before").unwrap();
    let mut host = Host::new();
    host.workspace(temp.path());
    host.send(json!({"command":"navigate","path":note})).await;
    assert_eq!(
        host.event("renderContent").await["markdownSource"],
        "# Before"
    );
    let dispatcher = host.dispatcher();
    let ignored = crate::workspace::watch::create_watch_change(temp.path(), "modify", "cache.tmp");
    dispatcher
        .refresh_from_watch(temp.path().to_owned(), Some(ignored))
        .await;
    assert!(host.events.try_recv().is_err());
    fs::write(&note, "# After").unwrap();
    let changed = crate::workspace::watch::create_watch_change(temp.path(), "modify", "note.md");
    dispatcher
        .refresh_from_watch(temp.path().to_owned(), Some(changed))
        .await;
    let updated = host.event("workspaceFilesChanged").await;
    assert_eq!(updated["fileList"][0]["title"], "After");
    assert_eq!(
        host.event("currentFileChanged").await["filePath"],
        json!(note)
    );
    fs::remove_file(&note).unwrap();
    host.send(json!({"command":"refresh"})).await;
    host.event("renderContent").await;
    assert!(host.state.inner.read().current_file.is_none());
}

#[tokio::test]
async fn native_close_notification_is_not_part_of_the_active_workspace_operation() {
    let mut host = Host::new();
    {
        let mut state = host.state.inner.write();
        state.workspace_operation_id = Some("operation".into());
        state.workspace_tab_id = Some("tab".into());
    }
    let app = host.app.handle();
    host_message::emit_native_close_requested(app, "close-1", "exit");
    host_message::emit_window_state_changed(app, true);
    host_message::emit_fullscreen_changed(app, false);
    assert_eq!(
        host.event("nativeCloseRequested").await,
        json!({"command":"nativeCloseRequested","requestId":"close-1","intent":"exit"})
    );
    let maximized = host.event("window-state-changed").await;
    assert_eq!(maximized["isMaximized"], true);
    assert_eq!(maximized["workspaceOperationId"], "operation");
    assert_eq!(
        host.event("fullscreenChanged").await["workspaceTabId"],
        "tab"
    );
}
