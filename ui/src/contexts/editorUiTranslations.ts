import type { AppLanguage } from './languageOptions';

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
}

export const EDITOR_UI_TRANSLATIONS: Record<AppLanguage, EditorUiTranslations> = {
  en: {
    modeGroup: 'Markdown editing mode',
    rendered: 'Rendered',
    inlineEdit: 'Inline Edit',
    plain: 'Plain',
    save: 'Save',
    plainSourceLabel: 'Markdown source',
    inlineSourceLabel: 'Markdown block source',
    apply: 'Apply',
    cancel: 'Cancel',
  },
  vi: {
    modeGroup: 'Chế độ chỉnh sửa Markdown',
    rendered: 'Đã hiển thị',
    inlineEdit: 'Sửa nội tuyến',
    plain: 'Văn bản thuần',
    save: 'Lưu',
    plainSourceLabel: 'Nguồn Markdown',
    inlineSourceLabel: 'Nguồn khối Markdown',
    apply: 'Áp dụng',
    cancel: 'Hủy',
  },
  fr: {
    modeGroup: 'Mode d’édition Markdown',
    rendered: 'Rendu',
    inlineEdit: 'Édition en ligne',
    plain: 'Texte brut',
    save: 'Enregistrer',
    plainSourceLabel: 'Source Markdown',
    inlineSourceLabel: 'Source du bloc Markdown',
    apply: 'Appliquer',
    cancel: 'Annuler',
  },
  es: {
    modeGroup: 'Modo de edición Markdown',
    rendered: 'Renderizado',
    inlineEdit: 'Edición en línea',
    plain: 'Texto plano',
    save: 'Guardar',
    plainSourceLabel: 'Fuente Markdown',
    inlineSourceLabel: 'Fuente del bloque Markdown',
    apply: 'Aplicar',
    cancel: 'Cancelar',
  },
  zh: {
    modeGroup: 'Markdown 编辑模式',
    rendered: '渲染',
    inlineEdit: '行内编辑',
    plain: '纯文本',
    save: '保存',
    plainSourceLabel: 'Markdown 源码',
    inlineSourceLabel: 'Markdown 块源码',
    apply: '应用',
    cancel: '取消',
  },
  no: {
    modeGroup: 'Markdown-redigeringsmodus',
    rendered: 'Gjengitt',
    inlineEdit: 'Direkteredigering',
    plain: 'Ren tekst',
    save: 'Lagre',
    plainSourceLabel: 'Markdown-kilde',
    inlineSourceLabel: 'Markdown-blokkkilde',
    apply: 'Bruk',
    cancel: 'Avbryt',
  },
  ja: {
    modeGroup: 'Markdown 編集モード',
    rendered: 'レンダリング',
    inlineEdit: 'インライン編集',
    plain: 'プレーン',
    save: '保存',
    plainSourceLabel: 'Markdown ソース',
    inlineSourceLabel: 'Markdown ブロックソース',
    apply: '適用',
    cancel: 'キャンセル',
  },
  ko: {
    modeGroup: 'Markdown 편집 모드',
    rendered: '렌더링',
    inlineEdit: '인라인 편집',
    plain: '일반 텍스트',
    save: '저장',
    plainSourceLabel: 'Markdown 소스',
    inlineSourceLabel: 'Markdown 블록 소스',
    apply: '적용',
    cancel: '취소',
  },
  ru: {
    modeGroup: 'Режим редактирования Markdown',
    rendered: 'Рендер',
    inlineEdit: 'Встроенное редактирование',
    plain: 'Исходный текст',
    save: 'Сохранить',
    plainSourceLabel: 'Исходник Markdown',
    inlineSourceLabel: 'Исходник блока Markdown',
    apply: 'Применить',
    cancel: 'Отмена',
  },
};

export function getEditorUiTranslations(language?: string): EditorUiTranslations {
  return EDITOR_UI_TRANSLATIONS[language as AppLanguage] ?? EDITOR_UI_TRANSLATIONS.en;
}
