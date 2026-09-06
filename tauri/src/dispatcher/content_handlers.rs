use super::*;
use crate::host_message::WorkspaceOperationMetadata;

#[derive(Clone)]
struct WorkspaceContentRequest {
    workspace_path: Option<PathBuf>,
    current_file: Option<PathBuf>,
    scan_generation: u64,
    operation: Option<WorkspaceOperationMetadata>,
}

impl Dispatcher {
    fn capture_workspace_request(&self) -> WorkspaceContentRequest {
        let state = self.state.inner.read();
        WorkspaceContentRequest {
            workspace_path: state.workspace_path.clone(),
            current_file: state.current_file.clone(),
            scan_generation: state.workspace_scan_generation,
            operation: WorkspaceOperationMetadata::from_parts(
                state.workspace_operation_id.as_deref(),
                state.workspace_tab_id.as_deref(),
            ),
        }
    }

    fn is_workspace_request_current(&self, request: &WorkspaceContentRequest) -> bool {
        let state = self.state.inner.read();
        state.workspace_path.as_ref() == request.workspace_path.as_ref()
            && state.current_file.as_ref() == request.current_file.as_ref()
            && state.workspace_scan_generation == request.scan_generation
            && WorkspaceOperationMetadata::from_parts(
                state.workspace_operation_id.as_deref(),
                state.workspace_tab_id.as_deref(),
            )
            .as_ref()
                == request.operation.as_ref()
    }

    pub(super) fn is_workspace_scan_current(
        &self,
        workspace_path: &Path,
        scan_generation: u64,
        operation: Option<&WorkspaceOperationMetadata>,
    ) -> bool {
        let state = self.state.inner.read();
        state.workspace_path.as_deref() == Some(workspace_path)
            && state.workspace_scan_generation == scan_generation
            && WorkspaceOperationMetadata::from_parts(
                state.workspace_operation_id.as_deref(),
                state.workspace_tab_id.as_deref(),
            )
            .as_ref()
                == operation
    }

    pub(super) fn send_initial_content_for_scan(
        &self,
        open_first_file: bool,
        workspace_path: &Path,
        scan_generation: u64,
        operation: Option<&WorkspaceOperationMetadata>,
    ) {
        if !self.is_workspace_scan_current(workspace_path, scan_generation, operation) {
            return;
        }
        if open_first_file {
            let mut state = self.state.inner.write();
            let current_operation = WorkspaceOperationMetadata::from_parts(
                state.workspace_operation_id.as_deref(),
                state.workspace_tab_id.as_deref(),
            );
            if state.workspace_path.as_deref() != Some(workspace_path)
                || state.workspace_scan_generation != scan_generation
                || current_operation.as_ref() != operation
            {
                return;
            }
            if state.current_file.is_none() {
                state.current_file = state
                    .flat_list
                    .first()
                    .map(|file| PathBuf::from(&file.fs_path));
            }
        }
        let request = self.capture_workspace_request();
        if request.workspace_path.as_deref() != Some(workspace_path)
            || request.scan_generation != scan_generation
            || request.operation.as_ref() != operation
        {
            return;
        }
        if request.current_file.is_some() {
            self.send_content_for_request(request);
        } else {
            self.send_welcome_for_request(request);
        }
    }

    pub(super) fn send_content(&self) {
        let request = self.capture_workspace_request();
        self.send_content_for_request(request);
    }

    fn send_content_for_request(&self, request: WorkspaceContentRequest) {
        let Some(current_file) = request.current_file.as_ref() else {
            return;
        };
        let Some(_workspace_path) = request.workspace_path.as_ref() else {
            return;
        };
        if !self.is_workspace_request_current(&request) {
            return;
        }

        let file_path_str = current_file.to_string_lossy().to_string();
        let (doc_conv, converter, flat_list) = {
            let state = self.state.inner.read();
            if state.workspace_path.as_ref() != request.workspace_path.as_ref()
                || state.current_file.as_ref() != request.current_file.as_ref()
                || state.workspace_scan_generation != request.scan_generation
            {
                return;
            }
            (
                state.document_conversion_enabled,
                state.converter.clone(),
                state.flat_list.clone(),
            )
        };
        let is_html_document = current_file
            .extension()
            .and_then(|ext| ext.to_str())
            .is_some_and(|ext| ext.eq_ignore_ascii_case("html") || ext.eq_ignore_ascii_case("htm"));
        let source_document_text = if is_html_document {
            std::fs::read_to_string(&current_file).ok()
        } else {
            None
        };
        let native_html_conversion = current_file
            .extension()
            .and_then(|ext| ext.to_str())
            .is_some_and(|ext| ext.eq_ignore_ascii_case("html"));
        let conversion_enabled = if is_html_document { true } else { doc_conv };
        let result = if is_html_document && !native_html_conversion {
            None
        } else {
            Some(converter.read_markdown(&file_path_str, conversion_enabled))
        };
        if !self.is_workspace_request_current(&request) {
            return;
        }
        let raw = result
            .as_ref()
            .map(|value| value.markdown.clone())
            .unwrap_or_default();
        let preview_info = result.and_then(|value| value.preview_info);

        let file_info = flat_list.iter().find(|file| file.fs_path == file_path_str);
        let relative_path = file_info
            .map(|file| file.relative_path.clone())
            .unwrap_or_else(|| file_path_str.clone());
        let title = file_info.map(|file| file.title.clone()).unwrap_or_else(|| {
            current_file
                .file_stem()
                .map(|name| name.to_string_lossy().to_string())
                .unwrap_or_default()
        });
        let document_write = if crate::workspace::file_types::is_markdown_file_path(&file_path_str) {
            super::commands::document_write::document_revision(current_file)
                .ok()
                .map(|revision| json!({ "supported": true, "revision": revision }))
        } else {
            None
        };

        let mut extra = serde_json::Map::new();
        extra.insert("html".into(), "".into());
        extra.insert("markdownSource".into(), raw.into());
        extra.insert("sourceDocumentText".into(), source_document_text.into());
        extra.insert("frontmatter".into(), json!({}));
        extra.insert("toc".into(), json!([]));
        extra.insert("filePath".into(), file_path_str.into());
        extra.insert("relativePath".into(), relative_path.into());
        extra.insert("title".into(), title.into());
        extra.insert("fileList".into(), json!(flat_list));
        extra.insert(
            "previewInfo".into(),
            serde_json::to_value(preview_info).unwrap_or(Value::Null),
        );
        if let Some(document_write) = document_write {
            extra.insert("documentWrite".into(), document_write);
        }
        host_message::emit_scoped(
            &self.app,
            "renderContent",
            extra,
            request.operation.as_ref(),
        );
    }

    pub(super) fn send_welcome(&self) {
        let request = self.capture_workspace_request();
        self.send_welcome_for_request(request);
    }

    fn send_welcome_for_request(&self, request: WorkspaceContentRequest) {
        if !self.is_workspace_request_current(&request) {
            return;
        }
        let flat_list = self.state.inner.read().flat_list.clone();
        if !self.is_workspace_request_current(&request) {
            return;
        }
        host_message::emit_render_content_empty_welcome_scoped(
            &self.app,
            json!(flat_list),
            request.operation.as_ref(),
        );
    }

}
