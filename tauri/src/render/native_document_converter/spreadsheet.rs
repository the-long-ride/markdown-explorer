use super::{
    markdown::{escape_inline, escape_table_cell},
    ConversionError, ConversionOutput, ConversionQuality,
};
use calamine::{open_workbook_auto, Reader};
use std::path::Path;

pub fn convert_ods(path: &Path) -> Result<ConversionOutput, ConversionError> {
    let mut workbook = open_workbook_auto(path)
        .map_err(|error| ConversionError::Parse(error.to_string()))?;
    let sheet_names = workbook.sheet_names().to_vec();
    let mut markdown = String::new();

    for sheet_name in sheet_names {
        let range = workbook
            .worksheet_range(&sheet_name)
            .map_err(|error| ConversionError::Parse(error.to_string()))?;
        let rows: Vec<Vec<String>> = range
            .rows()
            .map(|row| row.iter().map(ToString::to_string).collect())
            .collect();
        if rows
            .iter()
            .all(|row| row.iter().all(|cell| cell.trim().is_empty()))
        {
            continue;
        }
        if !markdown.is_empty() {
            markdown.push_str("\n\n");
        }
        markdown.push_str("## ");
        markdown.push_str(&escape_inline(&sheet_name));
        markdown.push_str("\n\n");
        markdown.push_str(&markdown_table(&rows));
    }

    Ok(ConversionOutput {
        markdown,
        quality: ConversionQuality::Standard,
    })
}

pub fn markdown_table(rows: &[Vec<String>]) -> String {
    let column_count = rows.iter().map(Vec::len).max().unwrap_or(0);
    if column_count == 0 {
        return String::new();
    }

    let render_row = |row: Option<&Vec<String>>| {
        let cells = (0..column_count)
            .map(|index| {
                row.and_then(|values| values.get(index))
                    .map(String::as_str)
                    .unwrap_or("")
            })
            .map(escape_table_cell)
            .collect::<Vec<_>>();
        format!("| {} |", cells.join(" | "))
    };

    let mut output = String::new();
    output.push_str(&render_row(rows.first()));
    output.push('\n');
    output.push('|');
    for _ in 0..column_count {
        output.push_str(" --- |");
    }
    for row in rows.iter().skip(1) {
        output.push('\n');
        output.push_str(&render_row(Some(row)));
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_deterministic_gfm_table_and_escapes_cells() {
        let table = markdown_table(&[
            vec!["Name".into(), "Notes".into()],
            vec!["A|B".into(), "line 1\nline 2".into()],
        ]);
        assert_eq!(
            table,
            "| Name | Notes |\n| --- | --- |\n| A\\|B | line 1<br>line 2 |"
        );
    }
}
