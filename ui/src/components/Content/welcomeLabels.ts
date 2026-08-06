export const cleanTitle = (text: string): string => {
  if (!text) return '';
  return text.replace(/^[✨⌨️🔒💡🔍🛠️📁📊📋🎨🖼️🐞🌐]\s*/u, '').replace(/\s*→\s*$/, '').trim();
};

export const TAB_LABELS: Record<
  string,
  {
    features: string;
    manual: string;
    shortcuts: string;
    privacy: string;
    tips: string;
    viewShortcuts: string;
  }
> = {
  en: {
    features: "Features",
    manual: "User manual",
    shortcuts: "Shortcuts",
    privacy: "Privacy",
    tips: "Tips & Practices",
    viewShortcuts: "View shortcuts"
  },
  vi: {
    features: "Tính năng",
    manual: "Hướng dẫn",
    shortcuts: "Phím tắt",
    privacy: "Riêng tư",
    tips: "Mẹo & Thực hành",
    viewShortcuts: "Xem phím tắt"
  },
  fr: {
    features: "Fonctionnalités",
    manual: "Manuel",
    shortcuts: "Raccourcis",
    privacy: "Confidentialité",
    tips: "Conseils",
    viewShortcuts: "Voir les raccourcis"
  },
  es: {
    features: "Funciones",
    manual: "Manual",
    shortcuts: "Atajos",
    privacy: "Privacidad",
    tips: "Consejos",
    viewShortcuts: "Ver atajos"
  },
  zh: {
    features: "功能特性",
    manual: "用户手册",
    shortcuts: "快捷键",
    privacy: "隐私",
    tips: "技巧与实践",
    viewShortcuts: "查看快捷键"
  },
  no: {
    features: "Funksjoner",
    manual: "Brukerhåndbok",
    shortcuts: "Snarveier",
    privacy: "Personvern",
    tips: "Tips",
    viewShortcuts: "Vis snarveier"
  },
  ja: {
    features: "功能一覧",
    manual: "ユーザーマニュアル",
    shortcuts: "ショートカット",
    privacy: "プライバシー",
    tips: "ヒントとコツ",
    viewShortcuts: "ショートカットを表示"
  },
  ko: {
    features: "기능 소개",
    manual: "사용자 설명서",
    shortcuts: "단축키",
    privacy: "개인정보",
    tips: "팁 및 가이드",
    viewShortcuts: "단축키 보기"
  },
  ru: {
    features: "Возможности",
    manual: "Руководство",
    shortcuts: "Сочетания клавиш",
    privacy: "Конфиденциальность",
    tips: "Советы",
    viewShortcuts: "Посмотреть сочетания"
  }
};
