use super::*;

impl Dispatcher {
    pub(super) fn emit_desktop_fonts_result(
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
}
