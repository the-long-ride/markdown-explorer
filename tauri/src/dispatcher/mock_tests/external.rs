use super::*;

#[tokio::test]
async fn text_resource_routes_return_content_and_reject_unsupported_or_outside_paths() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().join("root");
    fs::create_dir(&root).unwrap();
    fs::write(temp.path().join("outside.css"), "outside").unwrap();
    fs::write(root.join("theme.css"), "p { color: blue }").unwrap();
    fs::write(root.join("unreadable.css"), [0xff]).unwrap();
    let document = root.join("note.md");
    fs::write(&document, "# Note").unwrap();
    let mut host = Host::new();
    host.workspace(&root);
    for (reference, failure) in [
        ("theme.css?v=1#rules", None),
        ("/theme.css", None),
        ("../outside.css", Some("outside-workspace")),
        ("note.md", Some("outside-workspace")),
        ("https://example.org/theme.css", Some("unsupported")),
        ("//example.org/theme.css", Some("unsupported")),
        ("file://[", Some("unsupported")),
        #[cfg(unix)]
        ("file://remote.example/theme.css", Some("unsupported")),
        #[cfg(windows)]
        ("file:///theme.css", Some("unsupported")),
        ("javascript:alert(0)", Some("unsupported")),
        ("data:text/css,", Some("unsupported")),
        ("blob:theme.css", Some("unsupported")),
        ("", Some("unsupported")),
        ("absent.css", Some("missing")),
        ("unreadable.css", Some("unreadable")),
    ] {
        host.send(
            json!({"command":"readWorkspaceTextResource", "requestId":"text",
            "documentPath":document, "resourcePath":reference}),
        )
        .await;
        let event = host.event("workspaceTextResourceResult").await;
        assert_eq!(event["requestId"], "text");
        assert_eq!(event["ok"], failure.is_none());
        match failure {
            Some(reason) => assert_eq!(event["reason"], reason),
            None => assert_eq!(event["content"], "p { color: blue }"),
        }
    }
    host.send(
        json!({"command":"readWorkspaceExportResource","requestId":"export",
        "documentPath":document, "resourcePath":"theme.css"}),
    )
    .await;
    assert_eq!(
        host.event("workspaceExportResourceResult").await["ok"],
        true
    );
    host.send(json!({"command":"readWorkspaceExportResource","resourcePath":"missing.png"}))
        .await;
    assert_eq!(
        host.event("workspaceExportResourceResult").await["ok"],
        false
    );
    host.workspace(&temp.path().join("removed"));
    host.send(json!({"command":"readWorkspaceTextResource","documentPath":document,"resourcePath":"/theme.css"})).await;
    assert_eq!(
        host.event("workspaceTextResourceResult").await["reason"],
        "missing"
    );
}

#[tokio::test]
async fn external_dispatch_checks_scheme_and_paths_before_requesting_os_actions() {
    let temp = tempfile::tempdir().unwrap();
    let file = temp.path().join("note.md");
    fs::write(&file, "note").unwrap();
    let host = Host::new();
    let (sender, mut actions) = unbounded_channel::<Value>();
    host.app.listen("mock-native-action", move |event| {
        let _ = sender.send(serde_json::from_str(event.payload()).unwrap());
    });
    for message in [
        json!({"command":"openExternal","url":"javascript:alert(0)"}),
        json!({"command":"openExternal","url":"data:text/html,"}),
        json!({"command":"openExternal"}),
        json!({"command":"openInEditor","path":temp.path().join("missing.md")}),
        json!({"command":"openShellLocation","path":temp.path().join("missing.md"),"mode":"reveal-file"}),
        json!({"command":"openShellLocation","path":file,"mode":"unknown"}),
    ] {
        host.send(message).await;
    }
    assert!(actions.try_recv().is_err());
    for url in [
        "HTTPS://example.org",
        "http://example.org",
        "file:///example.md",
    ] {
        host.send(json!({"command":"openExternal","url":url})).await;
        assert_eq!(
            actions.try_recv().unwrap(),
            json!({"action":"open-url","value":url})
        );
    }
    for (command, mode, path, action, expected) in [
        (
            "openInEditor",
            "",
            file.as_path(),
            "open-path",
            file.as_path(),
        ),
        (
            "openShellLocation",
            "open-directory",
            temp.path(),
            "open-path",
            temp.path(),
        ),
        (
            "openShellLocation",
            "open-parent-directory",
            file.as_path(),
            "open-path",
            temp.path(),
        ),
        (
            "openShellLocation",
            "reveal-file",
            file.as_path(),
            "reveal-file",
            file.as_path(),
        ),
    ] {
        host.send(json!({"command":command,"path":path,"mode":mode}))
            .await;
        assert_eq!(
            actions.try_recv().unwrap(),
            json!({"action":action,"value":expected})
        );
    }
    host.send(json!({"command":"copyCode","text":"let x = 1;"}))
        .await;
    assert_eq!(
        actions.try_recv().unwrap(),
        json!({"action":"copy-text","value":"let x = 1;"})
    );
    assert!(host
        .dispatcher()
        .handle(json!({"command":"openHtmlPreview","documentHtml":""}))
        .await
        .is_err());
}

#[tokio::test]
async fn export_routes_report_written_files_rejected_data_and_cancelled_dialogs() {
    let temp = tempfile::tempdir().unwrap();
    let mut host = Host::new();
    let png = "data:image/png;base64,iVBORw0KGgo=";
    let chart =
        json!({"command":"saveChartPng","requestId":"chart","fileName":"graph","dataUrl":png});
    let target = temp.path().join("graph.png");
    host.dialog(Some(target.clone()));
    host.send(chart.clone()).await;
    let saved = host.event("chartPngSaveResult").await;
    assert_eq!(saved["ok"], true);
    assert_eq!(saved["requestId"], "chart");
    assert_eq!(fs::read(&target).unwrap(), b"\x89PNG\r\n\x1a\n");
    host.dialog(Some(temp.path().to_owned()));
    host.send(chart.clone()).await;
    let failed = host.event("chartPngSaveResult").await;
    assert_eq!(failed["ok"], false);
    assert!(failed["error"].is_string());
    host.send(chart).await;
    assert_eq!(host.event("chartPngSaveResult").await["ok"], false);
    host.send(json!({"command":"saveChartPng","dataUrl":png}))
        .await;
    assert!(host.events.try_recv().is_err());
    assert_eq!(
        host.dispatcher()
            .handle(json!({"command":"saveChartPng"}))
            .await
            .unwrap_err(),
        "Missing PNG data"
    );

    let export = json!({"command":"saveExportFile","requestId":"export","fileName":"output.txt","dataUrl":"data:text/plain;base64,dGV4dA=="});
    let target = temp.path().join("output.txt");
    host.dialog(Some(target.clone()));
    host.send(export.clone()).await;
    assert_eq!(host.event("exportFileSaveResult").await["ok"], true);
    assert_eq!(fs::read_to_string(&target).unwrap(), "text");
    host.dialog(Some(temp.path().to_owned()));
    host.send(export.clone()).await;
    assert_eq!(host.event("exportFileSaveResult").await["ok"], false);
    host.send(export).await;
    assert_eq!(host.event("exportFileSaveResult").await["ok"], false);
    host.send(json!({"command":"saveExportFile","requestId":"bad"}))
        .await;
    assert_eq!(
        host.event("exportFileSaveResult").await["error"],
        "Missing export data"
    );
}

#[tokio::test]
async fn font_routes_import_one_selected_family_and_remove_it() {
    let mut host = Host::new();
    host.send(json!({"command":"listDesktopFonts","requestId":"list"}))
        .await;
    let event = host.event("desktopFontsResult").await;
    assert_eq!(event["requestId"], "list");
    assert!(event["fonts"].is_array());
    host.send(json!({"command":"importDesktopFonts","requestId":"cancel"}))
        .await;
    assert!(host.event("desktopFontsResult").await["importedId"].is_null());
    let temp = tempfile::tempdir().unwrap();
    let invalid = temp.path().join("invalid.ttf");
    fs::write(&invalid, "").unwrap();
    host.dialog(Some(invalid));
    host.send(json!({"command":"importDesktopFonts","requestId":"invalid"}))
        .await;
    assert!(host.event("desktopFontsResult").await["error"].is_string());
    let font = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../ui/assets/fonts/BeVietnamPro/BeVietnamPro-Regular.ttf");
    host.dialog(Some(font));
    host.send(json!({"command":"importDesktopFonts","requestId":"import"}))
        .await;
    let imported = host.event("desktopFontsResult").await;
    let id = imported["importedId"]
        .as_str()
        .unwrap_or_else(|| panic!("{imported}"));
    assert!(imported["fonts"]
        .as_array()
        .unwrap()
        .iter()
        .any(|family| family["id"] == id));
    host.send(json!({"command":"removeImportedDesktopFont","requestId":"delete","id":id}))
        .await;
    let removed = host.event("desktopFontsResult").await;
    assert!(removed["error"].is_null(), "{removed}");
    assert!(!removed["fonts"]
        .as_array()
        .unwrap()
        .iter()
        .any(|family| family["id"] == id));
    host.send(json!({"command":"removeImportedDesktopFont"}))
        .await;
    assert_eq!(
        host.event("desktopFontsResult").await["error"],
        "Missing font id"
    );
}
