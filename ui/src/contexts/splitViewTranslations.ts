import type { AppLanguage } from './languageOptions';

export interface SplitViewTranslations {
  openInSplit: string;
  moveToOtherPane: string;
  swapPanes: string;
  closeSplit: string;
  primaryDocument: string;
  secondaryDocument: string;
  closeSecondaryPane: string;
  resizeDocumentPanes: string;
  noDocument: string;
}

export const SPLIT_VIEW_TRANSLATIONS: Record<AppLanguage, SplitViewTranslations> = {
  en: {
    openInSplit: 'Open in split', moveToOtherPane: 'Move to other pane', swapPanes: 'Swap panes', closeSplit: 'Close split',
    primaryDocument: 'Primary document', secondaryDocument: 'Secondary document', closeSecondaryPane: 'Close secondary pane',
    resizeDocumentPanes: 'Resize document panes', noDocument: 'No document',
  },
  vi: {
    openInSplit: 'Mở trong chế độ chia đôi', moveToOtherPane: 'Chuyển sang khung bên kia', swapPanes: 'Đổi hai khung', closeSplit: 'Đóng chia đôi',
    primaryDocument: 'Tài liệu chính', secondaryDocument: 'Tài liệu phụ', closeSecondaryPane: 'Đóng khung phụ',
    resizeDocumentPanes: 'Đổi kích thước các khung tài liệu', noDocument: 'Không có tài liệu',
  },
  fr: {
    openInSplit: 'Ouvrir en vue scindée', moveToOtherPane: 'Déplacer vers l’autre volet', swapPanes: 'Permuter les volets', closeSplit: 'Fermer la vue scindée',
    primaryDocument: 'Document principal', secondaryDocument: 'Document secondaire', closeSecondaryPane: 'Fermer le volet secondaire',
    resizeDocumentPanes: 'Redimensionner les volets de document', noDocument: 'Aucun document',
  },
  es: {
    openInSplit: 'Abrir en vista dividida', moveToOtherPane: 'Mover al otro panel', swapPanes: 'Intercambiar paneles', closeSplit: 'Cerrar vista dividida',
    primaryDocument: 'Documento principal', secondaryDocument: 'Documento secundario', closeSecondaryPane: 'Cerrar panel secundario',
    resizeDocumentPanes: 'Cambiar tamaño de los paneles', noDocument: 'Sin documento',
  },
  zh: {
    openInSplit: '在拆分视图中打开', moveToOtherPane: '移到另一窗格', swapPanes: '交换窗格', closeSplit: '关闭拆分视图',
    primaryDocument: '主文档', secondaryDocument: '次文档', closeSecondaryPane: '关闭次窗格',
    resizeDocumentPanes: '调整文档窗格大小', noDocument: '无文档',
  },
  no: {
    openInSplit: 'Åpne i delt visning', moveToOtherPane: 'Flytt til andre rute', swapPanes: 'Bytt ruter', closeSplit: 'Lukk delt visning',
    primaryDocument: 'Primærdokument', secondaryDocument: 'Sekundærdokument', closeSecondaryPane: 'Lukk sekundærrute',
    resizeDocumentPanes: 'Endre størrelse på dokumentruter', noDocument: 'Ingen dokument',
  },
  ja: {
    openInSplit: '分割表示で開く', moveToOtherPane: '反対側のペインへ移動', swapPanes: 'ペインを入れ替え', closeSplit: '分割表示を閉じる',
    primaryDocument: 'メイン文書', secondaryDocument: 'サブ文書', closeSecondaryPane: 'サブペインを閉じる',
    resizeDocumentPanes: '文書ペインのサイズを変更', noDocument: '文書なし',
  },
  ko: {
    openInSplit: '분할 보기에서 열기', moveToOtherPane: '다른 창으로 이동', swapPanes: '창 바꾸기', closeSplit: '분할 보기 닫기',
    primaryDocument: '기본 문서', secondaryDocument: '보조 문서', closeSecondaryPane: '보조 창 닫기',
    resizeDocumentPanes: '문서 창 크기 조절', noDocument: '문서 없음',
  },
  ru: {
    openInSplit: 'Открыть в разделённом виде', moveToOtherPane: 'Переместить в другую панель', swapPanes: 'Поменять панели местами', closeSplit: 'Закрыть разделение',
    primaryDocument: 'Основной документ', secondaryDocument: 'Дополнительный документ', closeSecondaryPane: 'Закрыть дополнительную панель',
    resizeDocumentPanes: 'Изменить размер панелей документов', noDocument: 'Нет документа',
  },
};

export function getSplitViewTranslations(language?: string): SplitViewTranslations {
  return SPLIT_VIEW_TRANSLATIONS[language as AppLanguage] ?? SPLIT_VIEW_TRANSLATIONS.en;
}
