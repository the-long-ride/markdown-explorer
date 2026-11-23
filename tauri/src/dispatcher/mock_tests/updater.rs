use super::*;
use crate::update::{manager::UpdateManager, UpdateState};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

#[tokio::test]
async fn updater_dispatch_rejects_unschedulable_state_and_verifies_persisted_success() {
    use crate::update::{manager::UpdateManager, UpdateState};

    let mut host = Host::new();
    host.send(json!({"command":"downloadUpdate"})).await;
    assert_eq!(
        host.event("updateStateChanged").await["state"]["error"],
        "missing-update-version"
    );
    host.send(json!({"command":"scheduleDownloadedUpdate"}))
        .await;
    assert_eq!(
        host.event("updateStateChanged").await["state"]["error"],
        "missing-downloaded-update"
    );
    let file = tempfile::NamedTempFile::new().unwrap();
    let path = file.path().to_string_lossy();
    host.state.inner.write().update_state =
        UpdateState::downloaded("9.0.0", "update").with_staged_file_path(&*path);
    host.send(json!({"command":"scheduleDownloadedUpdate"}))
        .await;
    assert_eq!(
        host.event("updateStateChanged").await["state"]["status"],
        "scheduled-on-exit"
    );
    assert!(UpdateManager::should_apply_on_close(&host.state));
    let manager = UpdateManager::new(host.app.path().app_config_dir().unwrap());
    assert_eq!(
        manager
            .load_persisted_state()
            .unwrap()
            .staged_file_path
            .as_deref(),
        Some(&*path)
    );
}

// Tauri updater's public offline test vector: the payload "test", signed for version 2.0.0.
pub(super) const PUBLIC_KEY: &str = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEE0OUVGNDc0NkZBNkU2RDcKUldUWDVxWnZkUFNlcERHV2cyYno4bjZBclFuQk13Z1FLMWdlVm9zb3JjYkx6Y3VuRCtLSitjWWU=";
const SIGNATURE: &str = "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVUWDVxWnZkUFNlcFBGMnpzanZQL0wvVFF0QkxSbldSdmFxKzRvbUsxVUV1Z3RRcC9VU3JHaUkxdjc2MnNEeTNpZDNhb3I3YlJDOUVUeWVvdDZsTUhIcldvWjVoalVNMVFjPQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxNzkxNjQ5MDUxCWZpbGU6cGF5bG9hZAl2ZXJzaW9uOjIuMC4wCkREcTJDTE9FbDVjUW1DMmVKUkhsblpQVlZpT1pzdTFDanBQS1FvZWk0QS9YQmZrRHFHTzBCK1FNcmNySGdFUTVxVjNtbmU3NXRkRldoSnBxVVhoOUFBPT0=";

#[tokio::test]
async fn updater_checks_version_stages_signed_download_and_handles_install_failure() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    let manifest = json!({
        "version":"2.0.0",
        "platforms":{"test-target":{"url":format!("{base}/update.bin"),"signature":SIGNATURE}}
    })
    .to_string();
    let response_mode = std::sync::Arc::new(AtomicUsize::new(0));
    let served_mode = response_mode.clone();
    let server = tokio::spawn(async move {
        loop {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut request = Vec::new();
            loop {
                let mut chunk = [0_u8; 1024];
                let count = socket.read(&mut chunk).await.unwrap();
                assert_ne!(count, 0);
                request.extend_from_slice(&chunk[..count]);
                if request.windows(4).any(|window| window == b"\r\n\r\n") {
                    break;
                }
            }
            let mode = served_mode.load(Ordering::SeqCst);
            let (status, content_type, body) = if request.starts_with(b"GET /manifest ") {
                match mode {
                    1 => ("204 No Content", "application/json", b"".as_slice()),
                    2 => ("200 OK", "application/json", b"invalid manifest".as_slice()),
                    _ => ("200 OK", "application/json", manifest.as_bytes()),
                }
            } else {
                assert!(request.starts_with(b"GET /update.bin "));
                let bytes = if mode == 3 {
                    b"corrupt".as_slice()
                } else {
                    b"test".as_slice()
                };
                ("200 OK", "application/octet-stream", bytes)
            };
            socket.write_all(format!(
                "HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                body.len()
            ).as_bytes()).await.unwrap();
            socket.write_all(body).await.unwrap();
        }
    });
    let mut host = Host::build(Some(&format!("{base}/manifest")));
    assert!(!UpdateManager::should_apply_on_close(&host.state));
    let config_dir = host.app.path().app_config_dir().unwrap();
    assert_eq!(
        UpdateManager::restore_and_emit(host.app.handle(), &config_dir).status,
        crate::update::UpdateStatus::Idle
    );
    host.send(json!({"command":"downloadUpdate"})).await;
    assert_eq!(
        host.event("updateStateChanged").await["state"]["error"],
        "missing-update-version"
    );
    host.send(json!({"command":"downloadUpdate","version":"3.0.0"}))
        .await;
    assert_eq!(
        host.event("updateStateChanged").await["state"]["error"],
        "update-version-mismatch:3.0.0:2.0.0"
    );
    for (mode, expected) in [
        (1, "requested-update-not-available"),
        (2, "failed to check update:"),
        (3, "failed to download update:"),
    ] {
        response_mode.store(mode, Ordering::SeqCst);
        assert_download_error(&mut host, expected).await;
    }
    response_mode.store(0, Ordering::SeqCst);
    let manager = UpdateManager::new(config_dir.clone());
    let staging = manager.staging_dir();
    fs::create_dir_all(&config_dir).unwrap();
    fs::write(&staging, "not a directory").unwrap();
    assert_download_error(&mut host, "failed to create updater staging directory:").await;
    fs::remove_file(&staging).unwrap();
    let artifact = staging.join("update.bin");
    fs::create_dir_all(&artifact).unwrap();
    assert_download_error(&mut host, "failed to stage downloaded update:").await;
    fs::remove_dir(&artifact).unwrap();
    fs::create_dir(manager.manifest_path()).unwrap();
    assert_download_error(&mut host, "failed to persist updater state:").await;
    fs::remove_dir(manager.manifest_path()).unwrap();
    host.send(json!({"command":"downloadUpdate","version":"2.0.0"}))
        .await;
    assert_eq!(
        host.event("updateStateChanged").await["state"]["status"],
        "downloading"
    );
    let downloaded = loop {
        let event = host.event("updateStateChanged").await;
        assert_ne!(event["state"]["status"], "error", "{event}");
        if event["state"]["status"] == "downloaded" {
            break event;
        }
    };
    let staged = downloaded["state"]["stagedFilePath"].as_str().unwrap();
    assert_eq!(fs::read(staged).unwrap(), b"test");
    host.send(json!({"command":"scheduleDownloadedUpdate"}))
        .await;
    assert_eq!(
        host.event("updateStateChanged").await["state"]["status"],
        "scheduled-on-exit"
    );
    assert!(UpdateManager::should_apply_on_close(&host.state));
    assert_eq!(
        UpdateManager::restore_and_emit(host.app.handle(), &config_dir)
            .staged_file_path
            .as_deref(),
        Some(staged)
    );
    assert_eq!(
        host.event("updateStateChanged").await["state"]["status"],
        "scheduled-on-exit"
    );
    host.state.pending_update.lock().unwrap().take();
    let app = host.app.handle().clone();
    let result = UpdateManager::apply_scheduled_update(app, host.state.clone()).await;
    assert_eq!(
        result.unwrap_err(),
        "failed to install update: native installer is unavailable under MockRuntime"
    );
    assert_eq!(
        host.event("updateStateChanged").await["state"]["status"],
        "applying"
    );
    assert_eq!(
        host.event("updateStateChanged").await["state"]["status"],
        "error"
    );
    assert_eq!(
        manager
            .load_persisted_state()
            .unwrap()
            .staged_file_path
            .as_deref(),
        Some(staged)
    );
    assert!(host.state.pending_update.lock().unwrap().is_some());
    assert!(!host.state.update_apply_in_progress.load(Ordering::SeqCst));
    host.state.pending_update.lock().unwrap().take();
    host.state.inner.write().update_state =
        UpdateState::downloaded("2.0.0", "update.bin").with_staged_file_path(staged);
    response_mode.store(1, Ordering::SeqCst);
    host.send(json!({"command":"restartAndApplyUpdate"})).await;
    assert_eq!(
        host.event("updateStateChanged").await["state"]["status"],
        "applying"
    );
    assert_eq!(
        host.event("updateStateChanged").await["state"]["error"],
        "requested-update-not-available"
    );
    host.state.inner.write().update_state = UpdateState::scheduled("2.0.0", "update.bin")
        .with_staged_file_path(staging.to_string_lossy());
    response_mode.store(0, Ordering::SeqCst);
    let result =
        UpdateManager::apply_scheduled_update(host.app.handle().clone(), host.state.clone()).await;
    assert!(result
        .unwrap_err()
        .starts_with("failed to read staged update:"));
    assert!(!host.state.update_apply_in_progress.load(Ordering::SeqCst));
    server.abort();
}

async fn assert_download_error(host: &mut Host, expected: &str) {
    host.send(json!({"command":"downloadUpdate","version":"2.0.0"}))
        .await;
    loop {
        let event = host.event("updateStateChanged").await;
        match event["state"]["status"].as_str().unwrap() {
            "downloading" => continue,
            "error" => {
                assert!(
                    event["state"]["error"]
                        .as_str()
                        .unwrap()
                        .starts_with(expected),
                    "{event}"
                );
                assert!(host.state.pending_update.lock().unwrap().is_none());
                break;
            }
            _ => panic!("expected download failure, got {event}"),
        }
    }
}

#[tokio::test]
async fn updater_does_not_apply_idle_updates_and_recovers_when_staged_file_is_missing() {
    let mut host = Host::new();
    let app = host.app.handle().clone();
    assert!(
        !UpdateManager::apply_scheduled_update(app.clone(), host.state.clone())
            .await
            .unwrap()
    );
    host.state.inner.write().update_state = UpdateState::scheduled("2.0.0", "update.bin");
    host.state
        .update_apply_in_progress
        .store(true, Ordering::SeqCst);
    assert!(
        UpdateManager::apply_scheduled_update(app.clone(), host.state.clone())
            .await
            .unwrap()
    );
    host.state
        .update_apply_in_progress
        .store(false, Ordering::SeqCst);
    assert_eq!(
        UpdateManager::apply_scheduled_update(app, host.state.clone())
            .await
            .unwrap_err(),
        "missing-staged-update"
    );
    assert_eq!(
        host.event("updateStateChanged").await["state"]["status"],
        "applying"
    );
    assert_eq!(
        host.event("updateStateChanged").await["state"]["error"],
        "missing-staged-update"
    );
    assert!(!host.state.update_apply_in_progress.load(Ordering::SeqCst));
}
