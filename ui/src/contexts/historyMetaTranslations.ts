import type { AppLanguage } from './languageOptions';

export interface HistoryMetaTranslations {
  copyCommitSha: string;
  copyAuthor: string;
  copied: string;
}

const HISTORY_META_TRANSLATIONS: Record<AppLanguage, HistoryMetaTranslations> = {
  en: { copyCommitSha: 'Copy commit SHA', copyAuthor: 'Copy author', copied: 'Copied' },
  vi: { copyCommitSha: 'Sao chép SHA commit', copyAuthor: 'Sao chép tác giả', copied: 'Đã sao chép' },
  fr: { copyCommitSha: 'Copier le SHA du commit', copyAuthor: 'Copier l’auteur', copied: 'Copié' },
  es: { copyCommitSha: 'Copiar SHA del commit', copyAuthor: 'Copiar autor', copied: 'Copiado' },
  zh: { copyCommitSha: '复制提交 SHA', copyAuthor: '复制作者', copied: '已复制' },
  no: { copyCommitSha: 'Kopier commit-SHA', copyAuthor: 'Kopier forfatter', copied: 'Kopiert' },
  ja: { copyCommitSha: 'コミット SHA をコピー', copyAuthor: '作者をコピー', copied: 'コピーしました' },
  ko: { copyCommitSha: '커밋 SHA 복사', copyAuthor: '작성자 복사', copied: '복사됨' },
  ru: { copyCommitSha: 'Копировать SHA коммита', copyAuthor: 'Копировать автора', copied: 'Скопировано' },
};

export function getHistoryMetaTranslations(language?: string): HistoryMetaTranslations {
  return HISTORY_META_TRANSLATIONS[language as AppLanguage] ?? HISTORY_META_TRANSLATIONS.en;
}
