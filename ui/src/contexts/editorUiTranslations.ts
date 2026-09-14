import type { AppLanguage } from './languageOptions';

export interface MarkdownFormattingTranslations {
  toolbar: string;
  bold: string;
  italic: string;
  heading: string;
  quote: string;
  inlineCode: string;
  codeBlock: string;
  link: string;
  bulletList: string;
  numberedList: string;
  taskList: string;
  table: string;
  undo: string;
  redo: string;
  preview: string;
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
  diskVersion: string;
  myEdit: string;
  formatting: MarkdownFormattingTranslations;
}

const EN_FORMATTING: MarkdownFormattingTranslations = {
  toolbar: 'Markdown formatting', bold: 'Bold', italic: 'Italic', heading: 'Heading', quote: 'Quote',
  inlineCode: 'Inline code', codeBlock: 'Code block', link: 'Link', bulletList: 'Bulleted list',
  numberedList: 'Numbered list', taskList: 'Task list', table: 'Table', undo: 'Undo', redo: 'Redo', preview: 'Preview',
};

export const EDITOR_UI_TRANSLATIONS: Record<AppLanguage, EditorUiTranslations> = {
  en: {
    modeGroup: 'Markdown editing mode', rendered: 'Rendered', inlineEdit: 'Inline Edit', plain: 'Plain', save: 'Save',
    plainSourceLabel: 'Markdown source', inlineSourceLabel: 'Markdown block source', apply: 'Apply', cancel: 'Cancel',
    unsavedChanges: 'Unsaved changes', diskVersion: 'Disk version', myEdit: 'My edit', formatting: EN_FORMATTING,
  },
  vi: {
    modeGroup: 'Chế độ chỉnh sửa Markdown', rendered: 'Đã hiển thị', inlineEdit: 'Sửa nội tuyến', plain: 'Văn bản thuần', save: 'Lưu',
    plainSourceLabel: 'Nguồn Markdown', inlineSourceLabel: 'Nguồn khối Markdown', apply: 'Áp dụng', cancel: 'Hủy',
    unsavedChanges: 'Thay đổi chưa lưu', diskVersion: 'Phiên bản trên đĩa', myEdit: 'Bản chỉnh sửa của tôi',
    formatting: { toolbar: 'Định dạng Markdown', bold: 'Đậm', italic: 'Nghiêng', heading: 'Tiêu đề', quote: 'Trích dẫn', inlineCode: 'Mã nội tuyến', codeBlock: 'Khối mã', link: 'Liên kết', bulletList: 'Danh sách dấu đầu dòng', numberedList: 'Danh sách đánh số', taskList: 'Danh sách công việc', table: 'Bảng', undo: 'Hoàn tác', redo: 'Làm lại', preview: 'Xem trước' },
  },
  fr: {
    modeGroup: 'Mode d’édition Markdown', rendered: 'Rendu', inlineEdit: 'Édition en ligne', plain: 'Texte brut', save: 'Enregistrer',
    plainSourceLabel: 'Source Markdown', inlineSourceLabel: 'Source du bloc Markdown', apply: 'Appliquer', cancel: 'Annuler',
    unsavedChanges: 'Modifications non enregistrées', diskVersion: 'Version sur disque', myEdit: 'Mes modifications',
    formatting: { toolbar: 'Mise en forme Markdown', bold: 'Gras', italic: 'Italique', heading: 'Titre', quote: 'Citation', inlineCode: 'Code en ligne', codeBlock: 'Bloc de code', link: 'Lien', bulletList: 'Liste à puces', numberedList: 'Liste numérotée', taskList: 'Liste de tâches', table: 'Tableau', undo: 'Annuler', redo: 'Rétablir', preview: 'Aperçu' },
  },
  es: {
    modeGroup: 'Modo de edición Markdown', rendered: 'Renderizado', inlineEdit: 'Edición en línea', plain: 'Texto plano', save: 'Guardar',
    plainSourceLabel: 'Fuente Markdown', inlineSourceLabel: 'Fuente del bloque Markdown', apply: 'Aplicar', cancel: 'Cancelar',
    unsavedChanges: 'Cambios sin guardar', diskVersion: 'Versión en disco', myEdit: 'Mi edición',
    formatting: { toolbar: 'Formato Markdown', bold: 'Negrita', italic: 'Cursiva', heading: 'Encabezado', quote: 'Cita', inlineCode: 'Código en línea', codeBlock: 'Bloque de código', link: 'Enlace', bulletList: 'Lista con viñetas', numberedList: 'Lista numerada', taskList: 'Lista de tareas', table: 'Tabla', undo: 'Deshacer', redo: 'Rehacer', preview: 'Vista previa' },
  },
  zh: {
    modeGroup: 'Markdown 编辑模式', rendered: '渲染', inlineEdit: '行内编辑', plain: '纯文本', save: '保存',
    plainSourceLabel: 'Markdown 源码', inlineSourceLabel: 'Markdown 块源码', apply: '应用', cancel: '取消',
    unsavedChanges: '未保存的更改', diskVersion: '磁盘版本', myEdit: '我的编辑',
    formatting: { toolbar: 'Markdown 格式', bold: '粗体', italic: '斜体', heading: '标题', quote: '引用', inlineCode: '行内代码', codeBlock: '代码块', link: '链接', bulletList: '项目符号列表', numberedList: '编号列表', taskList: '任务列表', table: '表格', undo: '撤销', redo: '重做', preview: '预览' },
  },
  no: {
    modeGroup: 'Markdown-redigeringsmodus', rendered: 'Gjengitt', inlineEdit: 'Direkteredigering', plain: 'Ren tekst', save: 'Lagre',
    plainSourceLabel: 'Markdown-kilde', inlineSourceLabel: 'Markdown-blokkkilde', apply: 'Bruk', cancel: 'Avbryt',
    unsavedChanges: 'Ulagrede endringer', diskVersion: 'Versjon på disk', myEdit: 'Min redigering',
    formatting: { toolbar: 'Markdown-formatering', bold: 'Fet', italic: 'Kursiv', heading: 'Overskrift', quote: 'Sitat', inlineCode: 'Kode i linjen', codeBlock: 'Kodeblokk', link: 'Lenke', bulletList: 'Punktliste', numberedList: 'Nummerert liste', taskList: 'Oppgaveliste', table: 'Tabell', undo: 'Angre', redo: 'Gjør om', preview: 'Forhåndsvisning' },
  },
  ja: {
    modeGroup: 'Markdown 編集モード', rendered: 'レンダリング', inlineEdit: 'インライン編集', plain: 'プレーン', save: '保存',
    plainSourceLabel: 'Markdown ソース', inlineSourceLabel: 'Markdown ブロックソース', apply: '適用', cancel: 'キャンセル',
    unsavedChanges: '未保存の変更', diskVersion: 'ディスク上のバージョン', myEdit: '自分の編集',
    formatting: { toolbar: 'Markdown 書式', bold: '太字', italic: '斜体', heading: '見出し', quote: '引用', inlineCode: 'インラインコード', codeBlock: 'コードブロック', link: 'リンク', bulletList: '箇条書き', numberedList: '番号付きリスト', taskList: 'タスクリスト', table: '表', undo: '元に戻す', redo: 'やり直す', preview: 'プレビュー' },
  },
  ko: {
    modeGroup: 'Markdown 편집 모드', rendered: '렌더링', inlineEdit: '인라인 편집', plain: '일반 텍스트', save: '저장',
    plainSourceLabel: 'Markdown 소스', inlineSourceLabel: 'Markdown 블록 소스', apply: '적용', cancel: '취소',
    unsavedChanges: '저장되지 않은 변경 사항', diskVersion: '디스크 버전', myEdit: '내 편집',
    formatting: { toolbar: 'Markdown 서식', bold: '굵게', italic: '기울임꼴', heading: '제목', quote: '인용', inlineCode: '인라인 코드', codeBlock: '코드 블록', link: '링크', bulletList: '글머리 기호 목록', numberedList: '번호 목록', taskList: '작업 목록', table: '표', undo: '실행 취소', redo: '다시 실행', preview: '미리 보기' },
  },
  ru: {
    modeGroup: 'Режим редактирования Markdown', rendered: 'Рендер', inlineEdit: 'Встроенное редактирование', plain: 'Исходный текст', save: 'Сохранить',
    plainSourceLabel: 'Исходник Markdown', inlineSourceLabel: 'Исходник блока Markdown', apply: 'Применить', cancel: 'Отмена',
    unsavedChanges: 'Несохранённые изменения', diskVersion: 'Версия на диске', myEdit: 'Моя правка',
    formatting: { toolbar: 'Форматирование Markdown', bold: 'Жирный', italic: 'Курсив', heading: 'Заголовок', quote: 'Цитата', inlineCode: 'Встроенный код', codeBlock: 'Блок кода', link: 'Ссылка', bulletList: 'Маркированный список', numberedList: 'Нумерованный список', taskList: 'Список задач', table: 'Таблица', undo: 'Отменить', redo: 'Повторить', preview: 'Предпросмотр' },
  },
};

export function getEditorUiTranslations(language?: string): EditorUiTranslations {
  return EDITOR_UI_TRANSLATIONS[language as AppLanguage] ?? EDITOR_UI_TRANSLATIONS.en;
}
