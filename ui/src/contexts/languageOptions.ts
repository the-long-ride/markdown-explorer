export const LANGUAGE_OPTIONS = [
  { id: "en", label: "English" },
  { id: "vi", label: "Tiếng Việt" },
  { id: "fr", label: "Français" },
  { id: "es", label: "Español" },
  { id: "zh", label: "中文" },
  { id: "no", label: "Norsk" },
  { id: "ja", label: "日本語" },
  { id: "ko", label: "한국어" },
  { id: "ru", label: "Русский" },
] as const;

export type AppLanguage = (typeof LANGUAGE_OPTIONS)[number]["id"];
