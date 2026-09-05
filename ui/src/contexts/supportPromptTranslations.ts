// =============================================================================
// contexts/supportPromptTranslations.ts — Community Support & Appreciation Translations
// =============================================================================

import type { AppLanguage } from './languageOptions';

export interface SupportPromptTranslations {
  title: string;
  message: string;
  starButton: string;
  donateButton: string;
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
    message: "You've been using Markdown Explorer for a while. If it helps you with your work, please consider supporting the project with a star on GitHub! It only takes a few seconds and supports open-source development.",
    starButton: 'Star on GitHub',
    donateButton: 'Donate',
    maybeLater: 'Maybe later',
    dontShowAgain: "Don't show this again",
    close: 'Close',
    homeSupportTitle: 'Support Markdown Explorer',
    homeSupportMessage: 'Enjoying Markdown Explorer? Consider giving us a star on GitHub to support ongoing development!',
    homeSupportButton: 'Star on GitHub',
  },
  vi: {
    title: 'Bạn có thích Markdown Explorer không?',
    message: 'Bạn đã sử dụng Markdown Explorer được một thời gian. Nếu nó giúp ích cho công việc của bạn, hãy ủng hộ dự án một ngôi sao trên GitHub nhé! Chỉ mất vài giây và giúp ích rất nhiều cho sự phát triển mã nguồn mở.',
    starButton: 'Tặng sao trên GitHub',
    donateButton: 'Ủng hộ',
    maybeLater: 'Để sau',
    dontShowAgain: 'Không hiển thị lại',
    close: 'Đóng',
    homeSupportTitle: 'Ủng hộ Markdown Explorer',
    homeSupportMessage: 'Thích Markdown Explorer? Hãy tặng một ngôi sao trên GitHub để ủng hộ dự án phát triển hơn nữa!',
    homeSupportButton: 'Tặng sao trên GitHub',
  },
  fr: {
    title: 'Vous appréciez Markdown Explorer ?',
    message: "Vous utilisez Markdown Explorer depuis un certain temps. Si l'application vous aide dans votre travail, pensez à soutenir le projet avec une étoile sur GitHub ! Cela ne prend que quelques secondes et soutient le développement open source.",
    starButton: 'Étoiler sur GitHub',
    donateButton: 'Faire un don',
    maybeLater: 'Plus tard',
    dontShowAgain: 'Ne plus afficher',
    close: 'Fermer',
    homeSupportTitle: 'Soutenez Markdown Explorer',
    homeSupportMessage: 'Vous aimez Markdown Explorer ? Donnez-nous une étoile sur GitHub pour encourager le développement continu !',
    homeSupportButton: 'Étoiler sur GitHub',
  },
  es: {
    title: '¿Te gusta Markdown Explorer?',
    message: 'Has estado usando Markdown Explorer durante un tiempo. Si te resulta útil en tu trabajo, ¡considera apoyar el proyecto con una estrella en GitHub! Solo toma unos segundos y apoya el desarrollo de código abierto.',
    starButton: 'Dar estrella en GitHub',
    donateButton: 'Donar',
    maybeLater: 'Quizás más tarde',
    dontShowAgain: 'No volver a mostrar',
    close: 'Cerrar',
    homeSupportTitle: 'Apoya Markdown Explorer',
    homeSupportMessage: '¿Disfrutas de Markdown Explorer? ¡Danos una estrella en GitHub para apoyar el desarrollo continuo!',
    homeSupportButton: 'Dar estrella en GitHub',
  },
  zh: {
    title: '喜欢 Markdown Explorer 吗？',
    message: '您已经使用 Markdown Explorer 一段时间了。如果它对您的工作有所帮助，请考虑在 GitHub 上支持我们点一颗星！只需几秒钟，却能对开源开发提供巨大支持。',
    starButton: '在 GitHub 上点星',
    donateButton: '赞助',
    maybeLater: '以后再说',
    dontShowAgain: '不再显示',
    close: '关闭',
    homeSupportTitle: '支持 Markdown Explorer',
    homeSupportMessage: '喜欢 Markdown Explorer 吗？欢迎在 GitHub 上点亮 Star 支持我们持续开发！',
    homeSupportButton: '在 GitHub 上点星',
  },
  no: {
    title: 'Liker du Markdown Explorer?',
    message: 'Du har brukt Markdown Explorer en stund. Hvis det hjelper deg i arbeidet ditt, vurder å støtte prosjektet med en stjerne på GitHub! Det tar bare noen sekunder og støtter åpen kildekode-utvikling.',
    starButton: 'Gi stjerne på GitHub',
    donateButton: 'Doner',
    maybeLater: 'Kanskje senere',
    dontShowAgain: 'Ikke vis dette igjen',
    close: 'Lukk',
    homeSupportTitle: 'Støtt Markdown Explorer',
    homeSupportMessage: 'Liker du Markdown Explorer? Gi oss en stjerne på GitHub for å støtte videre utvikling!',
    homeSupportButton: 'Gi stjerne på GitHub',
  },
  ja: {
    title: 'Markdown Explorer を気に入っていただけましたか？',
    message: 'Markdown Explorer をしばらくご利用いただきありがとうございます。もしお仕事のお役に立っている場合は、ぜひ GitHub でスターを付けて応援してください！数秒で完了し、オープンソース開発の大きな励みになります。',
    starButton: 'GitHub でスターを付ける',
    donateButton: '寄付する',
    maybeLater: '後で',
    dontShowAgain: '今後このメッセージを表示しない',
    close: '閉じる',
    homeSupportTitle: 'Markdown Explorer を応援',
    homeSupportMessage: 'Markdown Explorer をご愛用いただいていますか？GitHub でスターを付けて継続的な開発を応援してください！',
    homeSupportButton: 'GitHub でスターを付ける',
  },
  ko: {
    title: 'Markdown Explorer가 마음에 드시나요?',
    message: 'Markdown Explorer를 한동안 사용해 주셔서 감사합니다. 업무에 도움이 되었다면 GitHub에서 스타를 눌러 응원해 주세요! 몇 초면 충분하며 오픈소스 개발에 큰 힘이 됩니다.',
    starButton: 'GitHub에서 스타 주기',
    donateButton: '후원하기',
    maybeLater: '나중에',
    dontShowAgain: '다시 표시하지 않음',
    close: '닫기',
    homeSupportTitle: 'Markdown Explorer 응원하기',
    homeSupportMessage: 'Markdown Explorer가 마음에 드시나요? 지속적인 개발을 위해 GitHub에서 스타를 눌러 주세요!',
    homeSupportButton: 'GitHub에서 스타 주기',
  },
  ru: {
    title: 'Нравится Markdown Explorer?',
    message: 'Вы уже некоторое время используете Markdown Explorer. Если он помогает вам в работе, пожалуйста, поддержите проект звездой на GitHub! Это займёт пару секунд и поддержит развитие проекта с открытым исходным кодом.',
    starButton: 'Поставить звезду на GitHub',
    donateButton: 'Поддержать',
    maybeLater: 'Позже',
    dontShowAgain: 'Больше не показывать',
    close: 'Закрыть',
    homeSupportTitle: 'Поддержите Markdown Explorer',
    homeSupportMessage: 'Нравится Markdown Explorer? Поставьте звезду на GitHub, чтобы поддержать разработку проекта!',
    homeSupportButton: 'Поставить звезду на GitHub',
  },
};

export function getSupportPromptTranslations(language?: string): SupportPromptTranslations {
  if (language && language in SUPPORT_PROMPT_TRANSLATIONS) {
    return SUPPORT_PROMPT_TRANSLATIONS[language as AppLanguage];
  }
  return SUPPORT_PROMPT_TRANSLATIONS.en;
}
