import type { AppLanguage } from './languageOptions';

export interface MarkdownFormattingTranslations {
  toolbar: string;
  bold: string;
  italic: string;
  underline: string;
  heading: string;
  quote: string;
  inlineCode: string;
  codeBlock: string;
  link: string;
  bulletList: string;
  numberedList: string;
  taskList: string;
  table: string;
  properties: string;
  undo: string;
  redo: string;
  preview: string;
  wrapText: string;
  decreaseFontSize: string;
  increaseFontSize: string;
}

export interface EditorUiTranslations {
  modeGroup: string;
  rendered: string;
  inlineEdit: string;
  plain: string;
  save: string;
  plainSourceLabel: string;
  inlineSourceLabel: string;
  apply: string;
  cancel: string;
  unsavedChanges: string;
  unsavedChangesTitle: string;
  fileNotSavedPrompt: string;
  dontSaveAndLeave: string;
  diskVersion: string;
  myEdit: string;
  conflictTitle: string;
  conflictMessage: string;
  conflictReload: string;
  conflictCompare: string;
  conflictKeepMine: string;
  conflictDiskRevision: string;
  conflictComparing: string;
  conflictBackToResolution: string;
  inlineHint: string;
  saving: string;
  saved: string;
  saveFailed: string;
  saveFailedReadOnly: string;
  saveFailedPermissionDenied: string;
  saveFailedMissing: string;
  saveFailedOutsideWorkspace: string;
  saveFailedWriteFailed: string;
  statusLine: string;
  statusWords: string;
  statusCharacters: string;
  editBlock: string;
  toggleFormattingToolbar: string;
  insertTable: string;
  insertLink: string;
  linkUrl: string;
  linkUrlPlaceholder: string;
  linkText: string;
  linkTextPlaceholder: string;
  pasteUrl: string;
  tableColumns: string;
  tableRows: string;
  tableDimensions: string;
  insertTableRowAbove: string;
  insertTableRowBelow: string;
  deleteTableRow: string;
  insertTableColumnLeft: string;
  insertTableColumnRight: string;
  deleteTableColumn: string;
  insertLineBelow: string;
  viewRawMarkdown: string;
  viewRenderedTable: string;
  formatting: MarkdownFormattingTranslations;
}

const EN_FORMATTING: MarkdownFormattingTranslations = {
  toolbar: 'Markdown formatting', bold: 'Bold', italic: 'Italic', underline: 'Underline', heading: 'Heading', quote: 'Quote',
  inlineCode: 'Inline code', codeBlock: 'Code block', link: 'Link', bulletList: 'Bulleted list',
  numberedList: 'Numbered list', taskList: 'Task list', table: 'Table', properties: 'Insert properties',
  undo: 'Undo', redo: 'Redo', preview: 'Preview', wrapText: 'Wrap text',
  decreaseFontSize: 'Decrease font size', increaseFontSize: 'Increase font size',
};

export const EDITOR_UI_TRANSLATIONS: Record<AppLanguage, EditorUiTranslations> = {
  en: {
    inlineHint: '{mod}+Enter to apply · Esc to cancel', saving: 'Saving…', saved: 'Saved',
    saveFailed: "Could not save the file.", saveFailedReadOnly: "The file is read-only.", saveFailedPermissionDenied: "Permission denied.",
    saveFailedMissing: "The file no longer exists.", saveFailedOutsideWorkspace: "The file is outside the workspace.", saveFailedWriteFailed: "Writing to the file failed.",
    statusLine: 'Ln {line}, Col {column}', statusWords: '{count} words', statusCharacters: '{count} characters', editBlock: 'Edit this block (double-click)',
    toggleFormattingToolbar: 'Toggle formatting toolbar',
    conflictTitle: '{fileName} changed on disk', conflictMessage: 'The file changed after you started editing. Choose which version to keep.', conflictReload: 'Reload disk version', conflictCompare: 'Compare changes',
    conflictKeepMine: 'Keep my edit', conflictDiskRevision: 'Disk revision {revision}', conflictComparing: 'Comparing your edit with the disk version. Choose which version to keep when you are ready.', conflictBackToResolution: 'Back to conflict resolution',
    modeGroup: 'Markdown editing mode', rendered: 'Rendered', inlineEdit: 'Inline Edit', plain: 'Plain', save: 'Save',
    plainSourceLabel: 'Markdown source', inlineSourceLabel: 'Markdown block source', apply: 'Apply', cancel: 'Cancel',
    unsavedChanges: 'Unsaved changes', unsavedChangesTitle: 'Your changes has not been saved', fileNotSavedPrompt: 'The following file has not been saved:', dontSaveAndLeave: "Don't Save & Leave", diskVersion: 'Disk version', myEdit: 'My edit',
    insertTable: 'Insert Table', tableColumns: 'Columns', tableRows: 'Rows',
    insertLink: 'Insert link', linkUrl: 'URL', linkUrlPlaceholder: 'https://example.com', linkText: 'Link text', linkTextPlaceholder: 'Optional display text', pasteUrl: 'Paste from clipboard',
    tableDimensions: 'Row {rows} × {columns} Columns',
    insertTableRowAbove: 'Insert row above', insertTableRowBelow: 'Insert row below', deleteTableRow: 'Delete row',
    insertTableColumnLeft: 'Insert column left', insertTableColumnRight: 'Insert column right', deleteTableColumn: 'Delete column',
    insertLineBelow: 'Insert line below table',
    viewRawMarkdown: 'View raw Markdown', viewRenderedTable: 'View rendered table',
    formatting: EN_FORMATTING,
  },
  vi: {
    inlineHint: '{mod}+Enter để áp dụng · Esc để hủy', saving: 'Đang lưu…', saved: 'Đã lưu',
    saveFailed: "Không thể lưu tệp.", saveFailedReadOnly: "Tệp ở chế độ chỉ đọc.", saveFailedPermissionDenied: "Bị từ chối quyền truy cập.",
    saveFailedMissing: "Tệp không còn tồn tại.", saveFailedOutsideWorkspace: "Tệp nằm ngoài không gian làm việc.", saveFailedWriteFailed: "Ghi vào tệp không thành công.",
    statusLine: 'Dòng {line}, Cột {column}', statusWords: '{count} từ', statusCharacters: '{count} ký tự', editBlock: 'Nhấp đúp để chỉnh sửa khối này',
    toggleFormattingToolbar: 'Bật/tắt thanh công cụ định dạng',
    conflictTitle: '{fileName} đã thay đổi trên đĩa', conflictMessage: 'Tệp đã thay đổi sau khi bạn bắt đầu chỉnh sửa. Hãy chọn phiên bản muốn giữ.', conflictReload: 'Tải lại bản trên đĩa', conflictCompare: 'So sánh thay đổi',
    conflictKeepMine: 'Giữ bản sửa của tôi', conflictDiskRevision: 'Phiên bản trên đĩa {revision}', conflictComparing: 'Đang so sánh bản sửa của bạn với bản trên đĩa. Hãy chọn phiên bản muốn giữ khi sẵn sàng.', conflictBackToResolution: 'Quay lại giải quyết xung đột',
    modeGroup: 'Chế độ chỉnh sửa Markdown', rendered: 'Xem trước', inlineEdit: 'Sửa trực tiếp', plain: 'Mã nguồn', save: 'Lưu',
    plainSourceLabel: 'Mã nguồn Markdown', inlineSourceLabel: 'Mã nguồn khối Markdown', apply: 'Áp dụng', cancel: 'Hủy',
    unsavedChanges: 'Thay đổi chưa lưu', unsavedChangesTitle: 'Thay đổi chưa được lưu', fileNotSavedPrompt: 'Tệp sau chưa được lưu:', dontSaveAndLeave: 'Không lưu & Thoát', diskVersion: 'Bản gốc trên đĩa', myEdit: 'Bản sửa hiện tại',
    insertTable: 'Chèn bảng', tableColumns: 'Số cột', tableRows: 'Số hàng',
    insertLink: 'Chèn liên kết', linkUrl: 'URL', linkUrlPlaceholder: 'https://example.com', linkText: 'Văn bản liên kết', linkTextPlaceholder: 'Văn bản hiển thị tùy chọn', pasteUrl: 'Dán từ bảng tạm',
    tableDimensions: 'Hàng {rows} × {columns} Cột',
    insertTableRowAbove: 'Chèn hàng phía trên', insertTableRowBelow: 'Chèn hàng phía dưới', deleteTableRow: 'Xóa hàng',
    insertTableColumnLeft: 'Chèn cột bên trái', insertTableColumnRight: 'Chèn cột bên phải', deleteTableColumn: 'Xóa cột',
    insertLineBelow: 'Chèn dòng dưới bảng',
    viewRawMarkdown: 'Xem mã nguồn Markdown', viewRenderedTable: 'Xem bảng hiển thị',
    formatting: { toolbar: 'Định dạng Markdown', bold: 'Đậm', italic: 'Nghiêng', underline: 'Gạch chân', heading: 'Tiêu đề', quote: 'Trích dẫn', inlineCode: 'Mã nội tuyến', codeBlock: 'Khối mã', link: 'Liên kết', bulletList: 'Danh sách dấu đầu dòng', numberedList: 'Danh sách đánh số', taskList: 'Danh sách công việc', table: 'Bảng', properties: 'Chèn thuộc tính', undo: 'Hoàn tác', redo: 'Làm lại', preview: 'Xem trước', wrapText: 'Tự động xuống dòng', decreaseFontSize: 'Giảm cỡ chữ', increaseFontSize: 'Tăng cỡ chữ' },
  },
  fr: {
    inlineHint: '{mod}+Entrée pour appliquer · Échap pour annuler', saving: 'Enregistrement…', saved: 'Enregistré',
    saveFailed: "Impossible d’enregistrer le fichier.", saveFailedReadOnly: "Le fichier est en lecture seule.", saveFailedPermissionDenied: "Autorisation refusée.",
    saveFailedMissing: "Le fichier n’existe plus.", saveFailedOutsideWorkspace: "Le fichier se trouve en dehors de l’espace de travail.", saveFailedWriteFailed: "Échec de l’écriture dans le fichier.",
    statusLine: 'Ligne {line}, col. {column}', statusWords: '{count} mots', statusCharacters: '{count} caractères', editBlock: 'Double-cliquez pour modifier ce bloc',
    toggleFormattingToolbar: 'Afficher/masquer la barre de mise en forme',
    conflictTitle: '{fileName} a été modifié sur le disque', conflictMessage: 'Le fichier a changé après le début de votre modification. Choisissez la version à conserver.', conflictReload: 'Recharger la version du disque', conflictCompare: 'Comparer les modifications',
    conflictKeepMine: 'Conserver ma modification', conflictDiskRevision: 'Révision sur le disque {revision}', conflictComparing: 'Comparaison de votre modification avec la version du disque. Choisissez la version à conserver quand vous êtes prêt.', conflictBackToResolution: 'Retour à la résolution du conflit',
    modeGroup: 'Mode d’édition Markdown', rendered: 'Aperçu', inlineEdit: 'Édition en ligne', plain: 'Source', save: 'Enregistrer',
    plainSourceLabel: 'Source Markdown', inlineSourceLabel: 'Source du bloc Markdown', apply: 'Appliquer', cancel: 'Annuler',
    unsavedChanges: 'Modifications non enregistrées', unsavedChangesTitle: 'Modifications non enregistrées', fileNotSavedPrompt: 'Le fichier suivant n’a pas été enregistré :', dontSaveAndLeave: 'Quitter sans enregistrer', diskVersion: 'Version sur le disque', myEdit: 'Modifications en cours',
    insertTable: 'Insérer un tableau', tableColumns: 'Colonnes', tableRows: 'Lignes',
    insertLink: 'Insérer un lien', linkUrl: 'URL', linkUrlPlaceholder: 'https://exemple.com', linkText: 'Texte du lien', linkTextPlaceholder: 'Texte d’affichage facultatif', pasteUrl: 'Coller depuis le presse-papiers',
    tableDimensions: 'Ligne {rows} × {columns} colonnes',
    insertTableRowAbove: 'Insérer une ligne au-dessus', insertTableRowBelow: 'Insérer une ligne en dessous', deleteTableRow: 'Supprimer la ligne',
    insertTableColumnLeft: 'Insérer une colonne à gauche', insertTableColumnRight: 'Insérer une colonne à droite', deleteTableColumn: 'Supprimer la colonne',
    insertLineBelow: 'Insérer une ligne sous le tableau',
    viewRawMarkdown: 'Voir Markdown brut', viewRenderedTable: 'Voir tableau rendu',
    formatting: { toolbar: 'Mise en forme Markdown', bold: 'Gras', italic: 'Italique', underline: 'Souligné', heading: 'Titre', quote: 'Citation', inlineCode: 'Code en ligne', codeBlock: 'Bloc de code', link: 'Lien', bulletList: 'Liste à puces', numberedList: 'Liste numérotée', taskList: 'Liste de tâches', table: 'Tableau', properties: 'Insérer des propriétés', undo: 'Annuler', redo: 'Rétablir', preview: 'Aperçu', wrapText: 'Retour à la ligne', decreaseFontSize: 'Réduire la taille de police', increaseFontSize: 'Augmenter la taille de police' },
  },
  es: {
    inlineHint: '{mod}+Intro para aplicar · Esc para cancelar', saving: 'Guardando…', saved: 'Guardado',
    saveFailed: "No se pudo guardar el archivo.", saveFailedReadOnly: "El archivo es de solo lectura.", saveFailedPermissionDenied: "Permiso denegado.",
    saveFailedMissing: "El archivo ya no existe.", saveFailedOutsideWorkspace: "El archivo está fuera del espacio de trabajo.", saveFailedWriteFailed: "Error al escribir en el archivo.",
    statusLine: 'Línea {line}, col. {column}', statusWords: '{count} palabras', statusCharacters: '{count} caracteres', editBlock: 'Doble clic para editar este bloque',
    toggleFormattingToolbar: 'Mostrar u ocultar la barra de formato',
    conflictTitle: '{fileName} cambió en el disco', conflictMessage: 'El archivo cambió después de que empezaras a editarlo. Elige qué versión conservar.', conflictReload: 'Recargar la versión del disco', conflictCompare: 'Comparar cambios',
    conflictKeepMine: 'Conservar mi edición', conflictDiskRevision: 'Revisión en disco {revision}', conflictComparing: 'Comparando tu edición con la versión del disco. Elige qué versión conservar cuando estés listo.', conflictBackToResolution: 'Volver a la resolución del conflicto',
    modeGroup: 'Modo de edición Markdown', rendered: 'Vista previa', inlineEdit: 'Edición en línea', plain: 'Código fuente', save: 'Guardar',
    plainSourceLabel: 'Fuente Markdown', inlineSourceLabel: 'Fuente del bloque Markdown', apply: 'Aplicar', cancel: 'Cancelar',
    unsavedChanges: 'Cambios sin guardar', unsavedChangesTitle: 'Cambios sin guardar', fileNotSavedPrompt: 'El siguiente archivo no se ha guardado:', dontSaveAndLeave: 'Salir sin guardar', diskVersion: 'Versión en disco', myEdit: 'Cambios actuales',
    insertTable: 'Insertar tabla', tableColumns: 'Columnas', tableRows: 'Filas',
    insertLink: 'Insertar enlace', linkUrl: 'URL', linkUrlPlaceholder: 'https://ejemplo.com', linkText: 'Texto del enlace', linkTextPlaceholder: 'Texto visible opcional', pasteUrl: 'Pegar desde el portapapeles',
    tableDimensions: 'Fila {rows} × {columns} columnas',
    insertTableRowAbove: 'Insertar fila arriba', insertTableRowBelow: 'Insertar fila abajo', deleteTableRow: 'Eliminar fila',
    insertTableColumnLeft: 'Insertar columna a la izquierda', insertTableColumnRight: 'Insertar columna a la derecha', deleteTableColumn: 'Eliminar columna',
    insertLineBelow: 'Insertar línea debajo de la tabla',
    viewRawMarkdown: 'Ver Markdown sin formato', viewRenderedTable: 'Ver tabla renderizada',
    formatting: { toolbar: 'Formato Markdown', bold: 'Negrita', italic: 'Cursiva', underline: 'Subrayado', heading: 'Encabezado', quote: 'Cita', inlineCode: 'Código en línea', codeBlock: 'Bloque de código', link: 'Enlace', bulletList: 'Lista con viñetas', numberedList: 'Lista numerada', taskList: 'Lista de tareas', table: 'Tabla', properties: 'Insertar propiedades', undo: 'Deshacer', redo: 'Rehacer', preview: 'Vista previa', wrapText: 'Ajuste de línea', decreaseFontSize: 'Reducir tamaño de fuente', increaseFontSize: 'Aumentar tamaño de fuente' },
  },
  zh: {
    inlineHint: '{mod}+Enter 应用 · Esc 取消', saving: '正在保存…', saved: '已保存',
    saveFailed: "无法保存文件。", saveFailedReadOnly: "文件为只读。", saveFailedPermissionDenied: "权限被拒绝。",
    saveFailedMissing: "文件已不存在。", saveFailedOutsideWorkspace: "文件位于工作区之外。", saveFailedWriteFailed: "写入文件失败。",
    statusLine: '行 {line}，列 {column}', statusWords: '{count} 个词', statusCharacters: '{count} 个字符', editBlock: '双击以编辑此块',
    toggleFormattingToolbar: '切换格式工具栏',
    conflictTitle: '{fileName} 已在磁盘上更改', conflictMessage: '开始编辑后该文件已被更改。请选择要保留的版本。', conflictReload: '重新加载磁盘版本', conflictCompare: '比较更改',
    conflictKeepMine: '保留我的修改', conflictDiskRevision: '磁盘版本 {revision}', conflictComparing: '正在将你的修改与磁盘版本进行比较。准备好后请选择要保留的版本。', conflictBackToResolution: '返回冲突解决',
    modeGroup: 'Markdown 编辑模式', rendered: '预览', inlineEdit: '行内编辑', plain: '源代码', save: '保存',
    plainSourceLabel: 'Markdown 源码', inlineSourceLabel: 'Markdown 块源码', apply: '应用', cancel: '取消',
    unsavedChanges: '未保存的更改', unsavedChangesTitle: '更改尚未保存', fileNotSavedPrompt: '以下文件尚未保存：', dontSaveAndLeave: '不保存并退出', diskVersion: '磁盘上的版本', myEdit: '当前修改',
    insertTable: '插入表格', tableColumns: '列数', tableRows: '行数',
    insertLink: '插入链接', linkUrl: '链接地址', linkUrlPlaceholder: 'https://example.com', linkText: '链接文本', linkTextPlaceholder: '可选显示文本', pasteUrl: '从剪贴板粘贴',
    tableDimensions: '{rows} 行 × {columns} 列',
    insertTableRowAbove: '在上方插入行', insertTableRowBelow: '在下方插入行', deleteTableRow: '删除行',
    insertTableColumnLeft: '在左侧插入列', insertTableColumnRight: '在右侧插入列', deleteTableColumn: '删除列',
    insertLineBelow: '在表格下方插入行',
    viewRawMarkdown: '查看原始 Markdown', viewRenderedTable: '查看渲染表格',
    formatting: { toolbar: 'Markdown 格式', bold: '粗体', italic: '斜体', underline: '下划线', heading: '标题', quote: '引用', inlineCode: '行内代码', codeBlock: '代码块', link: '链接', bulletList: '项目符号列表', numberedList: '编号列表', taskList: '任务列表', table: '表格', properties: '插入属性', undo: '撤销', redo: '重做', preview: '预览', wrapText: '自动换行', decreaseFontSize: '减小字号', increaseFontSize: '增大字号' },
  },
  no: {
    inlineHint: '{mod}+Enter for å bruke · Esc for å avbryte', saving: 'Lagrer…', saved: 'Lagret',
    saveFailed: "Kunne ikke lagre filen.", saveFailedReadOnly: "Filen er skrivebeskyttet.", saveFailedPermissionDenied: "Tilgang nektet.",
    saveFailedMissing: "Filen finnes ikke lenger.", saveFailedOutsideWorkspace: "Filen ligger utenfor arbeidsområdet.", saveFailedWriteFailed: "Skriving til filen mislyktes.",
    statusLine: 'Linje {line}, kol. {column}', statusWords: '{count} ord', statusCharacters: '{count} tegn', editBlock: 'Dobbeltklikk for å redigere denne blokken',
    toggleFormattingToolbar: 'Vis/skjul formateringsverktøylinje',
    conflictTitle: '{fileName} er endret på disk', conflictMessage: 'Filen ble endret etter at du begynte å redigere. Velg hvilken versjon du vil beholde.', conflictReload: 'Last inn diskversjonen på nytt', conflictCompare: 'Sammenlign endringer',
    conflictKeepMine: 'Behold min endring', conflictDiskRevision: 'Diskrevisjon {revision}', conflictComparing: 'Sammenligner endringen din med versjonen på disk. Velg hvilken versjon du vil beholde når du er klar.', conflictBackToResolution: 'Tilbake til konfliktløsning',
    modeGroup: 'Markdown-redigeringsmodus', rendered: 'Forhåndsvisning', inlineEdit: 'Direkteredigering', plain: 'Kildekode', save: 'Lagre',
    plainSourceLabel: 'Markdown-kilde', inlineSourceLabel: 'Markdown-blokkilde', apply: 'Bruk', cancel: 'Avbryt',
    unsavedChanges: 'Ulagrede endringer', unsavedChangesTitle: 'Endringene er ikke lagret', fileNotSavedPrompt: 'Følgende fil er ikke lagret:', dontSaveAndLeave: 'Lukk uten å lagre', diskVersion: 'Lagret versjon på disk', myEdit: 'Gjeldende endringer',
    insertTable: 'Sett inn tabell', tableColumns: 'Kolonner', tableRows: 'Rader',
    insertLink: 'Sett inn lenke', linkUrl: 'URL', linkUrlPlaceholder: 'https://eksempel.no', linkText: 'Lenketekst', linkTextPlaceholder: 'Valgfri visningstekst', pasteUrl: 'Lim inn fra utklippstavlen',
    tableDimensions: 'Rad {rows} × {columns} kolonner',
    insertTableRowAbove: 'Sett inn rad over', insertTableRowBelow: 'Sett inn rad under', deleteTableRow: 'Slett rad',
    insertTableColumnLeft: 'Sett inn kolonne til venstre', insertTableColumnRight: 'Sett inn kolonne til høyre', deleteTableColumn: 'Slett kolonne',
    insertLineBelow: 'Sett inn linje under tabell',
    viewRawMarkdown: 'Vis rå Markdown', viewRenderedTable: 'Vis formatert tabell',
    formatting: { toolbar: 'Markdown-formatering', bold: 'Fet', italic: 'Kursiv', underline: 'Understreking', heading: 'Overskrift', quote: 'Sitat', inlineCode: 'Kode i linjen', codeBlock: 'Kodeblokk', link: 'Lenke', bulletList: 'Punktliste', numberedList: 'Nummerert liste', taskList: 'Oppgaveliste', table: 'Tabell', properties: 'Sett inn egenskaper', undo: 'Angre', redo: 'Gjør om', preview: 'Forhåndsvisning', wrapText: 'Tekstbryting', decreaseFontSize: 'Reduser skriftstørrelse', increaseFontSize: 'Øk skriftstørrelse' },
  },
  ja: {
    inlineHint: '{mod}+Enter で適用 · Esc でキャンセル', saving: '保存中…', saved: '保存済み',
    saveFailed: "ファイルを保存できませんでした。", saveFailedReadOnly: "ファイルは読み取り専用です。", saveFailedPermissionDenied: "アクセスが拒否されました。",
    saveFailedMissing: "ファイルは既に存在しません。", saveFailedOutsideWorkspace: "ファイルはワークスペースの外にあります。", saveFailedWriteFailed: "ファイルへの書き込みに失敗しました。",
    statusLine: '{line} 行、{column} 列', statusWords: '{count} 語', statusCharacters: '{count} 文字', editBlock: 'ダブルクリックしてこのブロックを編集',
    toggleFormattingToolbar: '書式ツールバーの表示切替',
    conflictTitle: '{fileName} はディスク上で変更されました', conflictMessage: '編集を開始した後にファイルが変更されました。保持するバージョンを選択してください。', conflictReload: 'ディスクのバージョンを再読み込み', conflictCompare: '変更を比較',
    conflictKeepMine: '自分の編集を保持', conflictDiskRevision: 'ディスクのリビジョン {revision}', conflictComparing: '編集内容とディスク上のバージョンを比較しています。準備ができたら保持するバージョンを選択してください。', conflictBackToResolution: '競合の解決に戻る',
    modeGroup: 'Markdown 編集モード', rendered: 'プレビュー', inlineEdit: 'インライン編集', plain: 'ソース', save: '保存',
    plainSourceLabel: 'Markdown ソース', inlineSourceLabel: 'Markdown ブロックソース', apply: '適用', cancel: 'キャンセル',
    unsavedChanges: '未保存の変更', unsavedChangesTitle: '変更は保存されていません', fileNotSavedPrompt: '以下のファイルは保存されていません：', dontSaveAndLeave: '保存せずに閉じる', diskVersion: 'ディスク上のバージョン', myEdit: '現在の編集内容',
    insertTable: '表を挿入', tableColumns: '列数', tableRows: '行数',
    insertLink: 'リンクを挿入', linkUrl: 'URL', linkUrlPlaceholder: 'https://example.com', linkText: 'リンクテキスト', linkTextPlaceholder: '表示テキスト（省略可能）', pasteUrl: 'クリップボードから貼り付け',
    tableDimensions: '{rows} 行 × {columns} 列',
    insertTableRowAbove: '上に行を挿入', insertTableRowBelow: '下に行を挿入', deleteTableRow: '行を削除',
    insertTableColumnLeft: '左に列を挿入', insertTableColumnRight: '右に列を挿入', deleteTableColumn: '列を削除',
    insertLineBelow: '表の下に新しい行を挿入',
    viewRawMarkdown: '未加工の Markdown を表示', viewRenderedTable: 'レンダリングされた表を表示',
    formatting: { toolbar: 'Markdown 書式', bold: '太字', italic: '斜体', underline: '下線', heading: '見出し', quote: '引用', inlineCode: 'インラインコード', codeBlock: 'コードブロック', link: 'リンク', bulletList: '箇条書き', numberedList: '番号付きリスト', taskList: 'タスクリスト', table: '表', properties: 'プロパティを挿入', undo: '元に戻す', redo: 'やり直す', preview: 'プレビュー', wrapText: '右端で折り返す', decreaseFontSize: '文字サイズを縮小', increaseFontSize: '文字サイズを拡大' },
  },
  ko: {
    inlineHint: '{mod}+Enter로 적용 · Esc로 취소', saving: '저장 중…', saved: '저장됨',
    saveFailed: "파일을 저장할 수 없습니다.", saveFailedReadOnly: "파일이 읽기 전용입니다.", saveFailedPermissionDenied: "권한이 거부되었습니다.",
    saveFailedMissing: "파일이 더 이상 존재하지 않습니다.", saveFailedOutsideWorkspace: "파일이 작업 공간 밖에 있습니다.", saveFailedWriteFailed: "파일 쓰기에 실패했습니다.",
    statusLine: '{line}행, {column}열', statusWords: '{count}단어', statusCharacters: '{count}자', editBlock: '더블클릭하여 이 블록 편집',
    toggleFormattingToolbar: '서식 도구모음 전환',
    conflictTitle: '{fileName} 파일이 디스크에서 변경되었습니다', conflictMessage: '편집을 시작한 후 파일이 변경되었습니다. 유지할 버전을 선택하세요.', conflictReload: '디스크 버전 다시 불러오기', conflictCompare: '변경 사항 비교',
    conflictKeepMine: '내 편집 유지', conflictDiskRevision: '디스크 리비전 {revision}', conflictComparing: '편집 내용을 디스크 버전과 비교하는 중입니다. 준비되면 유지할 버전을 선택하세요.', conflictBackToResolution: '충돌 해결로 돌아가기',
    modeGroup: 'Markdown 편집 모드', rendered: '미리보기', inlineEdit: '인라인 편집', plain: '소스', save: '저장',
    plainSourceLabel: 'Markdown 소스', inlineSourceLabel: 'Markdown 블록 소스', apply: '적용', cancel: '취소',
    unsavedChanges: '저장되지 않은 변경 사항', unsavedChangesTitle: '변경 사항이 저장되지 않았습니다', fileNotSavedPrompt: '다음 파일이 저장되지 않았습니다:', dontSaveAndLeave: '저장하지 않고 닫기', diskVersion: '디스크의 저장본', myEdit: '현재 편집본',
    insertTable: '표 삽입', tableColumns: '열', tableRows: '행',
    insertLink: '링크 삽입', linkUrl: 'URL', linkUrlPlaceholder: 'https://example.com', linkText: '링크 텍스트', linkTextPlaceholder: '선택적 표시 텍스트', pasteUrl: '클립보드에서 붙여넣기',
    tableDimensions: '{rows}행 × {columns}열',
    insertTableRowAbove: '위에 행 삽입', insertTableRowBelow: '아래에 행 삽입', deleteTableRow: '행 삭제',
    insertTableColumnLeft: '왼쪽에 열 삽입', insertTableColumnRight: '오른쪽에 열 삽입', deleteTableColumn: '열 삭제',
    insertLineBelow: '표 아래에 줄 삽입',
    viewRawMarkdown: '원시 Markdown 보기', viewRenderedTable: '렌더링된 표 보기',
    formatting: { toolbar: 'Markdown 서식', bold: '굵게', italic: '기울임꼴', underline: '밑줄', heading: '제목', quote: '인용', inlineCode: '인라인 코드', codeBlock: '코드 블록', link: '링크', bulletList: '글머리 기호 목록', numberedList: '번호 목록', taskList: '작업 목록', table: '표', properties: '속성 삽입', undo: '실행 취소', redo: '다시 실행', preview: '미리 보기', wrapText: '자동 줄 바꿈', decreaseFontSize: '글꼴 크기 축소', increaseFontSize: '글꼴 크기 확대' },
  },
  ru: {
    inlineHint: '{mod}+Enter — применить · Esc — отмена', saving: 'Сохранение…', saved: 'Сохранено',
    saveFailed: "Не удалось сохранить файл.", saveFailedReadOnly: "Файл доступен только для чтения.", saveFailedPermissionDenied: "Доступ запрещён.",
    saveFailedMissing: "Файл больше не существует.", saveFailedOutsideWorkspace: "Файл находится вне рабочей области.", saveFailedWriteFailed: "Не удалось записать файл.",
    statusLine: 'Стр. {line}, столб. {column}', statusWords: 'Слов: {count}', statusCharacters: 'Символов: {count}', editBlock: 'Двойной щелчок для редактирования',
    toggleFormattingToolbar: 'Переключить панель форматирования',
    conflictTitle: '{fileName} изменён на диске', conflictMessage: 'Файл изменился после того, как вы начали редактирование. Выберите, какую версию сохранить.', conflictReload: 'Загрузить версию с диска', conflictCompare: 'Сравнить изменения',
    conflictKeepMine: 'Оставить мою правку', conflictDiskRevision: 'Ревизия на диске {revision}', conflictComparing: 'Сравнение вашей правки с версией на диске. Когда будете готовы, выберите, какую версию сохранить.', conflictBackToResolution: 'Вернуться к разрешению конфликта',
    modeGroup: 'Режим редактирования Markdown', rendered: 'Предпросмотр', inlineEdit: 'Встроенное редактирование', plain: 'Исходник', save: 'Сохранить',
    plainSourceLabel: 'Исходник Markdown', inlineSourceLabel: 'Исходник блока Markdown', apply: 'Применить', cancel: 'Отмена',
    unsavedChanges: 'Несохранённые изменения', unsavedChangesTitle: 'Несохранённые изменения', fileNotSavedPrompt: 'Следующий файл не был сохранён:', dontSaveAndLeave: 'Закрыть без сохранения', diskVersion: 'Версия на диске', myEdit: 'Текущие правки',
    insertTable: 'Вставить таблицу', tableColumns: 'Столбцы', tableRows: 'Строки',
    insertLink: 'Вставить ссылку', linkUrl: 'URL', linkUrlPlaceholder: 'https://example.com', linkText: 'Текст ссылки', linkTextPlaceholder: 'Необязательный текст', pasteUrl: 'Вставить из буфера',
    tableDimensions: 'Строк: {rows} × столбцов: {columns}',
    insertTableRowAbove: 'Вставить строку выше', insertTableRowBelow: 'Вставить строку ниже', deleteTableRow: 'Удалить строку',
    insertTableColumnLeft: 'Вставить столбец слева', insertTableColumnRight: 'Вставить столбец справа', deleteTableColumn: 'Удалить столбец',
    insertLineBelow: 'Вставить строку под таблицей',
    viewRawMarkdown: 'Просмотреть исходный Markdown', viewRenderedTable: 'Просмотреть отрендеренную таблицу',
    formatting: { toolbar: 'Форматирование Markdown', bold: 'Жирный', italic: 'Курсив', underline: 'Подчёркнутый', heading: 'Заголовок', quote: 'Цитата', inlineCode: 'Встроенный код', codeBlock: 'Блок кода', link: 'Ссылка', bulletList: 'Маркированный список', numberedList: 'Нумерованный список', taskList: 'Список задач', table: 'Таблица', properties: 'Вставить свойства', undo: 'Отменить', redo: 'Повторить', preview: 'Предпросмотр', wrapText: 'Перенос строк', decreaseFontSize: 'Уменьшить размер шрифта', increaseFontSize: 'Увеличить размер шрифта' },
  },
};

export function getEditorUiTranslations(language?: string): EditorUiTranslations {
  return EDITOR_UI_TRANSLATIONS[language as AppLanguage] ?? EDITOR_UI_TRANSLATIONS.en;
}

export function formatTableDimensions(template: string, rows: number, cols: number): string {
  let text = template.replace('{rows}', String(rows)).replace('{columns}', String(cols));
  if (cols === 1) {
    text = text
      .replace(/Columns\b/i, 'Column')
      .replace(/colonnes\b/i, 'colonne')
      .replace(/columnas\b/i, 'columna')
      .replace(/kolonner\b/i, 'kolonne')
      .replace(/столбцов\b/i, 'столбец');
  }
  return text;
}
