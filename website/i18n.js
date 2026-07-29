window.LANGS = window.LANGS || {};

window.MdeI18n = {
  get(lang) {
    const english = { ...window.LANGS.en };
    const selected = window.LANGS[lang] || {};
    return { ...english, ...selected };
  },
};
