// =============================================================================
// contexts/supportPromptTranslations.ts — Community Support & Appreciation Translations
// =============================================================================

import type { AppLanguage } from './languageOptions';

export interface SupportPromptTranslations {
  title: string;
  message: string;
  starTitle: string;
  starDesc: string;
  starButton: string;
  donateTitle: string;
  donateDesc: string;
  donateButton: string;
  thanks: string;
  maybeLater: string;
  dontShowAgain: string;
  close: string;
  homeSupportTitle: string;
  homeSupportMessage: string;
  homeSupportButton: string;
}

export const SUPPORT_PROMPT_TRANSLATIONS: Record<AppLanguage, SupportPromptTranslations> = {
  en: {
    title: 'Enjoying Markdown Explorer?',
    message: "Thanks for spending time with Markdown Explorer! It's free, open source, and built with care in spare hours. If it makes your day a little easier, here are two ways to cheer it on:",
    starTitle: 'Leave a star',
    starDesc: 'Free and takes a few seconds. It helps others discover the project.',
    starButton: 'Star on GitHub',
    donateTitle: 'Make a donation',
    donateDesc: 'Any amount helps keep new features and fixes coming.',
    donateButton: 'Donate',
    thanks: 'Either way, thank you for being here!',
    maybeLater: 'Maybe later',
    dontShowAgain: "Don't show this again",
    close: 'Close',
    homeSupportTitle: 'Support Markdown Explorer',
    homeSupportMessage: 'Enjoying Markdown Explorer? A star or a small donation keeps it growing.',
    homeSupportButton: 'Star on GitHub',
  },
  vi: {
    title: 'Bạn có thích Markdown Explorer không?',
    message: 'Cảm ơn bạn đã dành thời gian cùng Markdown Explorer! Ứng dụng miễn phí, mã nguồn mở và được xây dựng tận tâm trong thời gian rảnh. Nếu nó giúp ngày làm việc của bạn nhẹ nhàng hơn, đây là hai cách để cổ vũ dự án:',
    starTitle: 'Tặng một ngôi sao',
    starDesc: 'Miễn phí và chỉ mất vài giây. Giúp nhiều người khác biết đến dự án.',
    starButton: 'Tặng sao trên GitHub',
    donateTitle: 'Ủng hộ tài chính',
    donateDesc: 'Mọi khoản ủng hộ đều giúp duy trì tính năng mới và các bản sửa lỗi.',
    donateButton: 'Ủng hộ',
    thanks: 'Dù thế nào, cảm ơn bạn đã luôn đồng hành!',
    maybeLater: 'Để sau',
    dontShowAgain: 'Không hiển thị lại',
    close: 'Đóng',
    homeSupportTitle: 'Ủng hộ Markdown Explorer',
    homeSupportMessage: 'Thích Markdown Explorer? Một ngôi sao hoặc một khoản ủng hộ nhỏ sẽ giúp dự án tiếp tục phát triển.',
    homeSupportButton: 'Tặng sao trên GitHub',
  },
  fr: {
    title: 'Vous appréciez Markdown Explorer ?',
    message: "Merci de passer du temps avec Markdown Explorer ! Il est gratuit, open source et développé avec soin sur du temps libre. S'il vous simplifie un peu la vie, voici deux façons de l'encourager :",
    starTitle: 'Laisser une étoile',
    starDesc: "Gratuit et rapide. Cela aide d'autres personnes à découvrir le projet.",
    starButton: 'Étoiler sur GitHub',
    donateTitle: 'Faire un don',
    donateDesc: 'Chaque montant aide à financer de nouvelles fonctionnalités et corrections.',
    donateButton: 'Faire un don',
    thanks: "Dans tous les cas, merci d'être là !",
    maybeLater: 'Plus tard',
    dontShowAgain: 'Ne plus afficher',
    close: 'Fermer',
    homeSupportTitle: 'Soutenez Markdown Explorer',
    homeSupportMessage: 'Vous aimez Markdown Explorer ? Une étoile ou un petit don l’aide à grandir.',
    homeSupportButton: 'Étoiler sur GitHub',
  },
  es: {
    title: '¿Te gusta Markdown Explorer?',
    message: '¡Gracias por pasar tiempo con Markdown Explorer! Es gratuito, de código abierto y está hecho con cariño en ratos libres. Si te facilita un poco el día, aquí tienes dos formas de apoyarlo:',
    starTitle: 'Deja una estrella',
    starDesc: 'Es gratis y toma unos segundos. Ayuda a que otros descubran el proyecto.',
    starButton: 'Dar estrella en GitHub',
    donateTitle: 'Haz una donación',
    donateDesc: 'Cualquier cantidad ayuda a mantener nuevas funciones y correcciones.',
    donateButton: 'Donar',
    thanks: '¡En cualquier caso, gracias por estar aquí!',
    maybeLater: 'Quizás más tarde',
    dontShowAgain: 'No volver a mostrar',
    close: 'Cerrar',
    homeSupportTitle: 'Apoya Markdown Explorer',
    homeSupportMessage: '¿Disfrutas de Markdown Explorer? Una estrella o una pequeña donación lo ayudan a crecer.',
    homeSupportButton: 'Dar estrella en GitHub',
  },
  zh: {
    title: '喜欢 Markdown Explorer 吗？',
    message: '感谢您使用 Markdown Explorer！它免费、开源，是利用业余时间用心打造的。如果它让您的工作轻松了一些，可以通过以下两种方式支持我们：',
    starTitle: '点亮一颗星',
    starDesc: '免费且只需几秒钟，帮助更多人发现这个项目。',
    starButton: '在 GitHub 上点星',
    donateTitle: '赞助项目',
    donateDesc: '任何金额都能帮助新功能和修复持续推出。',
    donateButton: '赞助',
    thanks: '无论如何，感谢您的陪伴！',
    maybeLater: '以后再说',
    dontShowAgain: '不再显示',
    close: '关闭',
    homeSupportTitle: '支持 Markdown Explorer',
    homeSupportMessage: '喜欢 Markdown Explorer 吗？一颗星或一笔小额赞助都能帮助它持续成长。',
    homeSupportButton: '在 GitHub 上点星',
  },
  no: {
    title: 'Liker du Markdown Explorer?',
    message: 'Takk for at du bruker Markdown Explorer! Det er gratis, åpen kildekode og laget med omtanke på fritiden. Hvis det gjør hverdagen din litt enklere, er det to måter å heie på prosjektet:',
    starTitle: 'Gi en stjerne',
    starDesc: 'Gratis og tar bare noen sekunder. Det hjelper andre å oppdage prosjektet.',
    starButton: 'Gi stjerne på GitHub',
    donateTitle: 'Gi en donasjon',
    donateDesc: 'Alle beløp hjelper med å holde nye funksjoner og rettelser i gang.',
    donateButton: 'Doner',
    thanks: 'Uansett, takk for at du er her!',
    maybeLater: 'Kanskje senere',
    dontShowAgain: 'Ikke vis dette igjen',
    close: 'Lukk',
    homeSupportTitle: 'Støtt Markdown Explorer',
    homeSupportMessage: 'Liker du Markdown Explorer? En stjerne eller en liten donasjon hjelper prosjektet å vokse.',
    homeSupportButton: 'Gi stjerne på GitHub',
  },
  ja: {
    title: 'Markdown Explorer を気に入っていただけましたか？',
    message: 'Markdown Explorer をご利用いただきありがとうございます！無料のオープンソースで、空き時間に心を込めて開発しています。お役に立っているなら、次の 2 つの方法で応援していただけると嬉しいです：',
    starTitle: 'スターを付ける',
    starDesc: '無料で数秒で完了します。より多くの人がプロジェクトを見つけられるようになります。',
    starButton: 'GitHub でスターを付ける',
    donateTitle: '寄付する',
    donateDesc: '金額を問わず、新機能や修正の継続に役立ちます。',
    donateButton: '寄付する',
    thanks: 'いずれにしても、ご利用いただきありがとうございます！',
    maybeLater: '後で',
    dontShowAgain: '今後このメッセージを表示しない',
    close: '閉じる',
    homeSupportTitle: 'Markdown Explorer を応援',
    homeSupportMessage: 'Markdown Explorer をご愛用いただいていますか？スターや少額の寄付が成長の力になります。',
    homeSupportButton: 'GitHub でスターを付ける',
  },
  ko: {
    title: 'Markdown Explorer가 마음에 드시나요?',
    message: 'Markdown Explorer를 사용해 주셔서 감사합니다! 무료 오픈소스이며 여가 시간에 정성껏 만들고 있습니다. 하루가 조금이라도 편해졌다면 두 가지 방법으로 응원해 주세요:',
    starTitle: '스타 남기기',
    starDesc: '무료이며 몇 초면 충분합니다. 더 많은 사람이 프로젝트를 발견하도록 도와줍니다.',
    starButton: 'GitHub에서 스타 주기',
    donateTitle: '후원하기',
    donateDesc: '금액에 상관없이 새로운 기능과 수정이 계속되는 데 도움이 됩니다.',
    donateButton: '후원하기',
    thanks: '어떤 방법이든, 함께해 주셔서 감사합니다!',
    maybeLater: '나중에',
    dontShowAgain: '다시 표시하지 않음',
    close: '닫기',
    homeSupportTitle: 'Markdown Explorer 응원하기',
    homeSupportMessage: 'Markdown Explorer가 마음에 드시나요? 스타나 작은 후원이 프로젝트 성장에 힘이 됩니다.',
    homeSupportButton: 'GitHub에서 스타 주기',
  },
  ru: {
    title: 'Нравится Markdown Explorer?',
    message: 'Спасибо, что пользуетесь Markdown Explorer! Он бесплатный, с открытым исходным кодом и создаётся с заботой в свободное время. Если он делает ваш день чуть проще, вот два способа поддержать проект:',
    starTitle: 'Поставьте звезду',
    starDesc: 'Бесплатно и займёт пару секунд. Это помогает другим найти проект.',
    starButton: 'Поставить звезду на GitHub',
    donateTitle: 'Сделайте пожертвование',
    donateDesc: 'Любая сумма помогает выпускать новые функции и исправления.',
    donateButton: 'Поддержать',
    thanks: 'В любом случае спасибо, что вы с нами!',
    maybeLater: 'Позже',
    dontShowAgain: 'Больше не показывать',
    close: 'Закрыть',
    homeSupportTitle: 'Поддержите Markdown Explorer',
    homeSupportMessage: 'Нравится Markdown Explorer? Звезда или небольшое пожертвование помогают проекту расти.',
    homeSupportButton: 'Поставить звезду на GitHub',
  },
};

export function getSupportPromptTranslations(language?: string): SupportPromptTranslations {
  if (language && language in SUPPORT_PROMPT_TRANSLATIONS) {
    return SUPPORT_PROMPT_TRANSLATIONS[language as AppLanguage];
  }
  return SUPPORT_PROMPT_TRANSLATIONS.en;
}
