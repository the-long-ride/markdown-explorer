use super::*;

impl Dispatcher {
    fn emit_desktop_fonts_result(
        &self,
        request_id: &str,
        imported_id: Option<String>,
        explicit_error: Option<String>,
    ) {
        let mut extra = serde_json::Map::new();
        extra.insert("requestId".into(), request_id.into());
        let catalog = self
            .app
            .path()
            .app_data_dir()
            .map_err(|error| error.to_string())
            .and_then(|path| crate::fonts::list_fonts(&path));
        match catalog {
            Ok(fonts) => {
                extra.insert(
                    "fonts".into(),
                    serde_json::to_value(fonts).unwrap_or_else(|_| json!([])),
                );
            }
            Err(error) => {
                extra.insert("fonts".into(), json!([]));
                extra.insert("error".into(), error.into());
            }
        }
        if let Some(id) = imported_id {
            extra.insert("importedId".into(), id.into());
        }
        if let Some(error) = explicit_error {
            extra.insert("error".into(), error.into());
        }
        host_message::emit(&self.app, "desktopFontsResult", extra);
    }
    pub(super) async fn handle_external_command(&self, cmd: &str, msg: &Value) -> Result<bool, String> {
        match cmd {
            "listDesktopFonts" => {
                let request_id = msg.get("requestId").and_then(Value::as_str).unwrap_or("");
                self.emit_desktop_fonts_result(request_id, None, None);
            }
            "importDesktopFonts" => {
                let request_id = msg.get("requestId").and_then(Value::as_str).unwrap_or("");
                let path = self.pick_font_file();
                if let Some(path) = path {
                    let app_data = self.app.path().app_data_dir().map_err(|error| error.to_string())?;
                    match crate::fonts::import_font_files(&app_data, &[path]) {
                        Ok(font) => self.emit_desktop_fonts_result(request_id, Some(font.id), None),
                        Err(error) => self.emit_desktop_fonts_result(request_id, None, Some(error)),
                    }
                } else {
                    self.emit_desktop_fonts_result(request_id, None, None);
                }
            }
            "removeImportedDesktopFont" => {
                let request_id = msg.get("requestId").and_then(Value::as_str).unwrap_or("");
                let app_data = self.app.path().app_data_dir().map_err(|error| error.to_string())?;
                let result = msg
                    .get("id")
                    .and_then(Value::as_str)
                    .ok_or_else(|| "Missing font id".to_string())
                    .and_then(|id| crate::fonts::remove_imported_font(&app_data, id));
                self.emit_desktop_fonts_result(request_id, None, result.err());
            }
            "saveChartPng" => {
                let file_name = crate::runtime::png_export::normalize_png_file_name(
                    msg.get("fileName").and_then(Value::as_str).unwrap_or("chart.png"),
                );
                let data_url = msg
                    .get("dataUrl")
                    .and_then(Value::as_str)
                    .ok_or_else(|| "Missing PNG data".to_string())?;
                let bytes = crate::runtime::png_export::decode_png_data_url(data_url)?;
                // Image-save callers pass a requestId and await this event to drive
                // their own notice; the legacy chart-save path omits it and keeps
                // relying on the global chartPngSaveResult listener.
                let request_id = msg
                    .get("requestId")
                    .and_then(Value::as_str)
                    .map(|s| s.to_string());
                let selected_path = tauri_plugin_dialog::DialogExt::dialog(&self.app)
                    .file()
                    .add_filter("PNG", &["png"])
                    .set_file_name(file_name)
                    .blocking_save_file()
                    .and_then(|path| path.into_path().ok());
                let mut extra = serde_json::Map::new();
                if let Some(id) = &request_id {
                    extra.insert("requestId".into(), id.clone().into());
                }
                match selected_path {
                    Some(path) => match std::fs::write(&path, bytes) {
                        Ok(()) => {
                            extra.insert("ok".into(), true.into());
                            extra.insert("path".into(), path.to_string_lossy().to_string().into());
                            host_message::emit(&self.app, "chartPngSaveResult", extra);
                        }
                        Err(error) => {
                            extra.insert("ok".into(), false.into());
                            extra.insert("error".into(), error.to_string().into());
                            host_message::emit(&self.app, "chartPngSaveResult", extra);
                        }
                    },
                    None => {
                        // Cancelled dialog. Emit a failure only when a requestId is
                        // present so the image-save awaiter resolves truthfully; the
                        // chart-save path (no requestId) stays silent on cancel, as
                        // it did before.
                        if request_id.is_some() {
                            extra.insert("ok".into(), false.into());
                            host_message::emit(&self.app, "chartPngSaveResult", extra);
                        }
                    }
                }
            }
            // ── C5: Clipboard / External / Editor ──
            "openInEditor" => {
                if let Some(path_str) = msg.get("path").and_then(Value::as_str) {
                    if Path::new(path_str).exists() {
                        let _ = self.app.opener().open_path(path_str, None::<&str>);
                    }
                }
            }
            "readWorkspaceTextResource" => {
                let request_id = msg
                    .get("requestId")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string();
                let mut extra = serde_json::Map::new();
                extra.insert("requestId".into(), request_id.into());
                let document_path = msg.get("documentPath").and_then(Value::as_str);
                let resource_path = msg.get("resourcePath").and_then(Value::as_str);
                let workspace_path = self.state.inner.read().workspace_path.clone();
                let result = (|| -> Result<(String, String), &'static str> {
                    let document_path = document_path.ok_or("unsupported")?;
                    let resource_path = resource_path.ok_or("unsupported")?;
                    let workspace_path = workspace_path.ok_or("missing")?;
                    let workspace_base = if workspace_path.is_file() {
                        workspace_path.parent().unwrap_or(workspace_path.as_path()).to_path_buf()
                    } else {
                        workspace_path
                    };
                    let reference = resource_path
                        .split(|character| character == '?' || character == '#')
                        .next()
                        .unwrap_or("");
                    if reference.is_empty()
                        || reference.starts_with("http://")
                        || reference.starts_with("https://")
                        || reference.starts_with("//")
                        || reference.starts_with("data:")
                        || reference.starts_with("blob:")
                        || reference.starts_with("javascript:")
                    {
                        return Err("unsupported");
                    }
                    let resolved = if reference.starts_with("file://") {
                        Url::parse(reference)
                            .map_err(|_| "unsupported")?
                            .to_file_path()
                            .map_err(|_| "unsupported")?
                    } else if reference.starts_with('/') {
                        workspace_base.join(reference.trim_start_matches('/'))
                    } else {
                        let reference_path = Path::new(reference);
                        if reference_path.is_absolute() {
                            reference_path.to_path_buf()
                        } else {
                            Path::new(document_path)
                                .parent()
                                .unwrap_or(workspace_base.as_path())
                                .join(reference_path)
                        }
                    };
                    let allowed = resolved
                        .extension()
                        .and_then(|ext| ext.to_str())
                        .map_or(false, |ext| matches!(ext.to_ascii_lowercase().as_str(), "css" | "js" | "mjs" | "cjs"));
                    if !allowed {
                        return Err("outside-workspace");
                    }
                    let canonical_workspace = workspace_base.canonicalize().map_err(|_| "missing")?;
                    let canonical_target = resolved.canonicalize().map_err(|_| "missing")?;
                    if !canonical_target.starts_with(&canonical_workspace) || !canonical_target.is_file() {
                        return Err("outside-workspace");
                    }
                    let content = std::fs::read_to_string(&canonical_target).map_err(|_| "unreadable")?;
                    Ok((content, canonical_target.to_string_lossy().into_owned()))
                })();
                match result {
                    Ok((content, resolved_path)) => {
                        extra.insert("ok".into(), true.into());
                        extra.insert("content".into(), content.into());
                        extra.insert("resolvedPath".into(), resolved_path.into());
                    }
                    Err(reason) => {
                        extra.insert("ok".into(), false.into());
                        extra.insert("reason".into(), reason.into());
                    }
                }
                host_message::emit(&self.app, "workspaceTextResourceResult", extra);
            }
            "openShellLocation" => {
                if let (Some(path_str), Some(mode)) = (
                    msg.get("path").and_then(Value::as_str),
                    msg.get("mode").and_then(Value::as_str),
                ) {
                    let source = Path::new(path_str);
                    if source.exists() {
                        match mode {
                            "open-directory" => {
                                let _ = self.app.opener().open_path(
                                    source.to_string_lossy().into_owned(),
                                    None::<&str>,
                                );
                            }
                            "open-parent-directory" => {
                                if let Some(parent) = source.parent() {
                                    let _ = self.app.opener().open_path(
                                        parent.to_string_lossy().into_owned(),
                                        None::<&str>,
                                    );
                                }
                            }
                            "reveal-file" => {
                                #[cfg(target_os = "windows")]
                                {
                                    let _ = std::process::Command::new("explorer")
                                        .arg(format!("/select,{}", source.display()))
                                        .spawn();
                                }
                                #[cfg(target_os = "macos")]
                                {
                                    let _ = std::process::Command::new("open")
                                        .arg("-R")
                                        .arg(source)
                                        .spawn();
                                }
                                #[cfg(target_os = "linux")]
                                {
                                    if let Some(parent) = source.parent() {
                                        let _ = self.app.opener().open_path(
                                            parent.to_string_lossy().into_owned(),
                                            None::<&str>,
                                        );
                                    }
                                }
                            }
                            _ => {}
                        }
                    }
                }
            }
            "copyCode" => {
                let text = msg.get("text").and_then(Value::as_str).unwrap_or("");
                let _ = self.app.clipboard().write_text(text);
            }
            "openExternal" => {
                if let Some(url) = msg.get("url").and_then(Value::as_str) {
                    let url_lower = url.to_lowercase();
                    if url_lower.starts_with("http://")
                        || url_lower.starts_with("https://")
                        || url_lower.starts_with("file://")
                    {
                        let _ = self.app.opener().open_url(url, None::<&str>);
                    }
                }
            }
            "openHtmlPreview" => {
                if let Some(document_html) = msg.get("documentHtml").and_then(Value::as_str) {
                    crate::runtime::html_preview::open(&self.app, document_html)
                        .await
                        .map_err(|error| error.to_string())?;
                }
            }
            "setDocumentConversion" => {
                self.handle_set_document_conversion(&msg).await;
            }
            _ => return Ok(false),
        }
        Ok(true)
    }
}
