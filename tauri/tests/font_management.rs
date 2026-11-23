use markdown_explorer_tauri_lib::fonts::{
    import_font_files, inspect_font_file, list_fonts, remove_imported_font,
};
use std::fs;
use std::path::{Path, PathBuf};

fn bundled_font(name: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../ui/assets/fonts")
        .join(name)
}

#[test]
fn imports_lists_and_removes_bundled_faces() {
    let temp = tempfile::tempdir().unwrap();
    let app_data = temp.path().join("app-data");
    let upright = temp.path().join("Normal face.TTF");
    fs::copy(
        bundled_font("BeVietnamPro/BeVietnamPro-Regular.ttf"),
        &upright,
    )
    .unwrap();
    let italic = bundled_font("BeVietnamPro/BeVietnamPro-Italic.ttf");

    let family = import_font_files(&app_data, &[upright, italic]).unwrap();
    assert_eq!(family.family.replace(' ', ""), "BeVietnamPro");
    assert_eq!(family.source, "imported");
    assert_eq!(
        family.css_family,
        format!("MarkdownExplorer Imported {}", family.id)
    );
    assert!(family.available);
    assert_eq!(family.faces.len(), 2);
    assert_eq!(family.faces[0].style, "normal");
    assert_eq!(family.faces[0].min_weight, 400);
    assert_eq!(family.faces[1].style, "italic");
    assert!(!family.faces[1].variable);
    assert!(family.faces[0]
        .css_url
        .as_ref()
        .unwrap()
        .ends_with("01-Normal-face.TTF"));

    let ignored = app_data.join("fonts/unmanaged");
    fs::create_dir(&ignored).unwrap();
    fs::copy(
        bundled_font("BeVietnamPro/BeVietnamPro-Regular.ttf"),
        ignored.join("regular.ttf"),
    )
    .unwrap();
    let listed = list_fonts(&app_data).unwrap();
    let imported: Vec<_> = listed
        .iter()
        .filter(|item| item.source == "imported")
        .collect();
    assert_eq!(imported.len(), 1);
    assert_eq!(imported[0].id, family.id);
    assert_eq!(imported[0].faces.len(), 2);

    remove_imported_font(&app_data, &family.id).unwrap();
    remove_imported_font(&app_data, &family.id).unwrap();
    assert!(!app_data.join("fonts").join(family.id).exists());
    assert!(ignored.is_dir());
}

#[test]
fn rejects_invalid_imports_without_leaving_managed_files() {
    let dir = tempfile::tempdir().unwrap();
    let app_data = dir.path().join("app-data");
    let unsupported = dir.path().join("font.woff");
    let invalid = dir.path().join("invalid.ttf");
    fs::write(&invalid, b"not a font").unwrap();

    assert!(import_font_files(&app_data, &[])
        .unwrap_err()
        .contains("at least one"));
    assert!(
        import_font_files(&app_data, std::slice::from_ref(&unsupported))
            .unwrap_err()
            .contains("Only .ttf and .otf")
    );
    assert_eq!(
        inspect_font_file(&unsupported).unwrap_err(),
        "Unsupported font file type"
    );
    assert!(inspect_font_file(&dir.path().join("missing.ttf")).is_err());
    assert!(inspect_font_file(&invalid)
        .unwrap_err()
        .contains("metadata is missing"));
    assert!(import_font_files(
        &app_data,
        &[
            bundled_font("BeVietnamPro/BeVietnamPro-Regular.ttf"),
            bundled_font("JetBrainsMono/JetBrainsMono-VariableFont_wght.ttf"),
        ],
    )
    .unwrap_err()
    .contains("one font family"));
    assert!(!app_data.exists());
    assert_eq!(
        remove_imported_font(&app_data, "font_invalid!").unwrap_err(),
        "Invalid imported font id."
    );
}
