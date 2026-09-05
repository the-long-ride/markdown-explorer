import type { AppLanguage } from './languageOptions';
import { INSIGHTS_TRANSLATIONS, type InsightsTranslations } from './insightsTranslations';

const GALLERY_KEYS = ['image', 'diagram', 'video', 'audio', 'document'] as const;
const STATUS_KEYS = ['valid', 'invalid', 'exists', 'missing', 'outside-workspace', 'unreadable', 'unsupported', 'too-large', 'ambiguous', 'invalid-anchor', 'dynamic', 'reachable', 'reachable-auth-required', 'broken', 'rate-limited', 'server-error', 'unreachable', 'unchecked'] as const;
const PRESET_KEYS = ['default', 'link-focused', 'tag-focused', 'terminology-focused', 'custom'] as const;
const LINT_RULE_KEYS = ['frontmatter/malformed', 'frontmatter/duplicate-key', 'frontmatter/invalid-insights-metadata', 'heading/skipped-level', 'heading/duplicate', 'table/malformed-delimiter', 'table/column-count', 'list/inconsistent-marker', 'list/indentation', 'format/trailing-whitespace', 'wiki/malformed', 'link/malformed-uri', 'mermaid/invalid'] as const;

export type InsightsGalleryCategory = typeof GALLERY_KEYS[number];
export type InsightsPresentationStatus = typeof STATUS_KEYS[number];
export type InsightsRelationshipPreset = typeof PRESET_KEYS[number];

export interface InsightsPresentationTranslations {
  readonly galleryCategories: Readonly<Record<InsightsGalleryCategory, string>>;
  readonly statuses: Readonly<Record<InsightsPresentationStatus, string>>;
  readonly relationshipPresets: Readonly<Record<InsightsRelationshipPreset, string>>;
  readonly lintRules: Readonly<Record<string, string>>;
}

export interface InsightsUiTranslations extends InsightsTranslations {
  readonly presentation: InsightsPresentationTranslations;
}

function dictionary<K extends string>(keys: readonly K[], values: readonly string[]): Readonly<Record<K, string>> {
  if (keys.length !== values.length) throw new Error('Insights translation dictionary length mismatch');
  return Object.fromEntries(keys.map((key, index) => [key, values[index]])) as Record<K, string>;
}

function presentation(
  gallery: readonly string[], statuses: readonly string[], presets: readonly string[], lintRules: readonly string[],
): InsightsPresentationTranslations {
  return {
    galleryCategories: dictionary(GALLERY_KEYS, gallery),
    statuses: dictionary(STATUS_KEYS, statuses),
    relationshipPresets: dictionary(PRESET_KEYS, presets),
    lintRules: dictionary(LINT_RULE_KEYS, lintRules),
  };
}

export const INSIGHTS_PRESENTATION_TRANSLATIONS: Record<AppLanguage, InsightsPresentationTranslations> = {
  en: presentation(
    ['Image', 'Diagram', 'Video', 'Audio', 'Document'],
    ['Valid', 'Invalid', 'Exists', 'Missing', 'Outside workspace', 'Unreadable', 'Unsupported', 'Too large', 'Ambiguous', 'Invalid anchor', 'Dynamic / not statically checkable', 'Reachable', 'Reachable (authentication required)', 'Broken', 'Rate limited', 'Server error', 'Unreachable', 'Unchecked'],
    ['Default', 'Link-focused', 'Tag-focused', 'Terminology-focused', 'Custom'],
    ['Malformed frontmatter', 'Duplicate frontmatter key', 'Invalid Insights frontmatter metadata', 'Skipped heading level', 'Duplicate heading', 'Malformed table delimiter', 'Table column count mismatch', 'Inconsistent list marker', 'Invalid list indentation', 'Trailing whitespace', 'Malformed Wiki Link', 'Malformed absolute URI', 'Invalid Mermaid diagram declaration'],
  ),
  vi: presentation(
    ['Ảnh', 'Sơ đồ', 'Video', 'Âm thanh', 'Tài liệu'],
    ['Hợp lệ', 'Không hợp lệ', 'Tồn tại', 'Thiếu', 'Ngoài không gian làm việc', 'Không đọc được', 'Không được hỗ trợ', 'Quá lớn', 'Không rõ ràng', 'Neo không hợp lệ', 'Động / không thể kiểm tra tĩnh', 'Có thể truy cập', 'Có thể truy cập (cần xác thực)', 'Hỏng', 'Bị giới hạn tần suất', 'Lỗi máy chủ', 'Không thể truy cập', 'Chưa kiểm tra'],
    ['Mặc định', 'Ưu tiên liên kết', 'Ưu tiên thẻ', 'Ưu tiên thuật ngữ', 'Tùy chỉnh'],
    ['Frontmatter không hợp lệ', 'Khóa frontmatter bị trùng', 'Metadata Insights trong frontmatter không hợp lệ', 'Bỏ qua cấp tiêu đề', 'Tiêu đề bị trùng', 'Dòng phân cách bảng không hợp lệ', 'Số cột bảng không khớp', 'Dấu đầu dòng không nhất quán', 'Thụt lề danh sách không hợp lệ', 'Khoảng trắng cuối dòng', 'Wiki Link không hợp lệ', 'URI tuyệt đối không hợp lệ', 'Khai báo sơ đồ Mermaid không hợp lệ'],
  ),
  fr: presentation(
    ['Image', 'Diagramme', 'Vidéo', 'Audio', 'Document'],
    ['Valide', 'Invalide', 'Existe', 'Manquant', 'Hors de l’espace de travail', 'Illisible', 'Non pris en charge', 'Trop volumineux', 'Ambigu', 'Ancre invalide', 'Dynamique / non vérifiable statiquement', 'Accessible', 'Accessible (authentification requise)', 'Cassé', 'Débit limité', 'Erreur serveur', 'Inaccessible', 'Non vérifié'],
    ['Par défaut', 'Axé sur les liens', 'Axé sur les tags', 'Axé sur la terminologie', 'Personnalisé'],
    ['Frontmatter mal formé', 'Clé de frontmatter dupliquée', 'Métadonnées Insights du frontmatter invalides', 'Niveau de titre sauté', 'Titre dupliqué', 'Délimiteur de tableau mal formé', 'Nombre de colonnes du tableau incohérent', 'Marqueur de liste incohérent', 'Indentation de liste invalide', 'Espaces en fin de ligne', 'Wiki Link mal formé', 'URI absolue mal formée', 'Déclaration de diagramme Mermaid invalide'],
  ),
  es: presentation(
    ['Imagen', 'Diagrama', 'Vídeo', 'Audio', 'Documento'],
    ['Válido', 'No válido', 'Existe', 'Falta', 'Fuera del espacio de trabajo', 'No legible', 'No compatible', 'Demasiado grande', 'Ambiguo', 'Ancla no válida', 'Dinámico / no comprobable estáticamente', 'Accesible', 'Accesible (requiere autenticación)', 'Roto', 'Limitado por frecuencia', 'Error del servidor', 'Inaccesible', 'Sin comprobar'],
    ['Predeterminado', 'Prioridad a enlaces', 'Prioridad a etiquetas', 'Prioridad a terminología', 'Personalizado'],
    ['Frontmatter mal formado', 'Clave de frontmatter duplicada', 'Metadatos de Insights no válidos en el frontmatter', 'Nivel de encabezado omitido', 'Encabezado duplicado', 'Delimitador de tabla mal formado', 'El número de columnas de la tabla no coincide', 'Marcador de lista incoherente', 'Sangría de lista no válida', 'Espacios al final de la línea', 'Wiki Link mal formado', 'URI absoluta mal formada', 'Declaración de diagrama Mermaid no válida'],
  ),
  zh: presentation(
    ['图像', '图表', '视频', '音频', '文档'],
    ['有效', '无效', '存在', '缺失', '工作区外', '无法读取', '不支持', '过大', '有歧义', '无效锚点', '动态 / 无法静态检查', '可访问', '可访问（需要身份验证）', '链接失效', '速率受限', '服务器错误', '无法访问', '未检查'],
    ['默认', '链接优先', '标签优先', '术语优先', '自定义'],
    ['Frontmatter 格式错误', 'Frontmatter 键重复', 'Frontmatter 中的 Insights 元数据无效', '标题级别跳跃', '标题重复', '表格分隔行格式错误', '表格列数不匹配', '列表标记不一致', '列表缩进无效', '行尾空白', 'Wiki Link 格式错误', '绝对 URI 格式错误', 'Mermaid 图表声明无效'],
  ),
  no: presentation(
    ['Bilde', 'Diagram', 'Video', 'Lyd', 'Dokument'],
    ['Gyldig', 'Ugyldig', 'Finnes', 'Mangler', 'Utenfor arbeidsområdet', 'Kan ikke leses', 'Ikke støttet', 'For stor', 'Tvetydig', 'Ugyldig anker', 'Dynamisk / kan ikke kontrolleres statisk', 'Tilgjengelig', 'Tilgjengelig (krever autentisering)', 'Brutt', 'Hastighetsbegrenset', 'Serverfeil', 'Utilgjengelig', 'Ikke kontrollert'],
    ['Standard', 'Lenkevektet', 'Taggvektet', 'Terminologivektet', 'Tilpasset'],
    ['Ugyldig frontmatter', 'Duplisert frontmatter-nøkkel', 'Ugyldige Insights-metadata i frontmatter', 'Overskriftsnivå hoppet over', 'Duplisert overskrift', 'Ugyldig tabellskille', 'Antall tabellkolonner stemmer ikke', 'Ulik listemarkør', 'Ugyldig listeinnrykk', 'Mellomrom på slutten av linjen', 'Ugyldig Wiki Link', 'Ugyldig absolutt URI', 'Ugyldig Mermaid-diagramdeklarasjon'],
  ),
  ja: presentation(
    ['画像', '図', '動画', '音声', 'ドキュメント'],
    ['有効', '無効', '存在', '見つかりません', 'ワークスペース外', '読み取り不可', '未対応', '大きすぎます', 'あいまい', '無効なアンカー', '動的 / 静的に確認不可', '到達可能', '到達可能（認証が必要）', '壊れています', 'レート制限', 'サーバーエラー', '到達不能', '未確認'],
    ['既定', 'リンク重視', 'タグ重視', '用語重視', 'カスタム'],
    ['Frontmatter の形式が不正', 'Frontmatter キーが重複', 'Frontmatter の Insights メタデータが無効', '見出しレベルの飛び越し', '見出しの重複', '表の区切り行が不正', '表の列数が一致しません', 'リスト記号が不統一', 'リストのインデントが無効', '行末の空白', 'Wiki Link の形式が不正', '絶対 URI の形式が不正', 'Mermaid 図の宣言が無効'],
  ),
  ko: presentation(
    ['이미지', '다이어그램', '비디오', '오디오', '문서'],
    ['유효', '유효하지 않음', '존재함', '누락됨', '작업 공간 외부', '읽을 수 없음', '지원되지 않음', '너무 큼', '모호함', '잘못된 앵커', '동적 / 정적 검사 불가', '접근 가능', '접근 가능(인증 필요)', '끊어진 링크', '속도 제한됨', '서버 오류', '접근 불가', '확인하지 않음'],
    ['기본', '링크 중심', '태그 중심', '용어 중심', '사용자 지정'],
    ['Frontmatter 형식 오류', 'Frontmatter 키 중복', 'Frontmatter의 Insights 메타데이터가 잘못됨', '제목 수준 건너뜀', '제목 중복', '표 구분 행 형식 오류', '표 열 수 불일치', '목록 표시가 일관되지 않음', '목록 들여쓰기가 잘못됨', '줄 끝 공백', 'Wiki Link 형식 오류', '절대 URI 형식 오류', 'Mermaid 다이어그램 선언이 잘못됨'],
  ),
  ru: presentation(
    ['Изображение', 'Диаграмма', 'Видео', 'Аудио', 'Документ'],
    ['Корректно', 'Некорректно', 'Существует', 'Отсутствует', 'Вне рабочего пространства', 'Нечитаемо', 'Не поддерживается', 'Слишком большой', 'Неоднозначно', 'Некорректный якорь', 'Динамический / статическая проверка невозможна', 'Доступно', 'Доступно (требуется аутентификация)', 'Нерабочая ссылка', 'Ограничение частоты', 'Ошибка сервера', 'Недоступно', 'Не проверено'],
    ['По умолчанию', 'Акцент на ссылках', 'Акцент на тегах', 'Акцент на терминологии', 'Пользовательский'],
    ['Некорректный frontmatter', 'Дублирующийся ключ frontmatter', 'Некорректные метаданные Insights во frontmatter', 'Пропущен уровень заголовка', 'Дублирующийся заголовок', 'Некорректный разделитель таблицы', 'Число столбцов таблицы не совпадает', 'Несогласованный маркер списка', 'Некорректный отступ списка', 'Пробелы в конце строки', 'Некорректный Wiki Link', 'Некорректный абсолютный URI', 'Некорректное объявление диаграммы Mermaid'],
  ),
};

export const INSIGHTS_UI_TRANSLATIONS: Record<AppLanguage, InsightsUiTranslations> = {
  en: { ...INSIGHTS_TRANSLATIONS.en, presentation: INSIGHTS_PRESENTATION_TRANSLATIONS.en },
  vi: { ...INSIGHTS_TRANSLATIONS.vi, presentation: INSIGHTS_PRESENTATION_TRANSLATIONS.vi },
  fr: { ...INSIGHTS_TRANSLATIONS.fr, presentation: INSIGHTS_PRESENTATION_TRANSLATIONS.fr },
  es: { ...INSIGHTS_TRANSLATIONS.es, presentation: INSIGHTS_PRESENTATION_TRANSLATIONS.es },
  zh: { ...INSIGHTS_TRANSLATIONS.zh, presentation: INSIGHTS_PRESENTATION_TRANSLATIONS.zh },
  no: { ...INSIGHTS_TRANSLATIONS.no, presentation: INSIGHTS_PRESENTATION_TRANSLATIONS.no },
  ja: { ...INSIGHTS_TRANSLATIONS.ja, presentation: INSIGHTS_PRESENTATION_TRANSLATIONS.ja },
  ko: { ...INSIGHTS_TRANSLATIONS.ko, presentation: INSIGHTS_PRESENTATION_TRANSLATIONS.ko },
  ru: { ...INSIGHTS_TRANSLATIONS.ru, presentation: INSIGHTS_PRESENTATION_TRANSLATIONS.ru },
};

export function ensureInsightsUiTranslations(labels?: InsightsTranslations | InsightsUiTranslations): InsightsUiTranslations {
  if (labels && 'presentation' in labels) return labels as InsightsUiTranslations;
  return { ...(labels ?? INSIGHTS_TRANSLATIONS.en), presentation: INSIGHTS_PRESENTATION_TRANSLATIONS.en };
}

export function insightsStatusLabel(labels: InsightsUiTranslations, status: InsightsPresentationStatus): string {
  return labels.presentation.statuses[status];
}

export function insightsLintRuleLabel(labels: InsightsUiTranslations, ruleId: string): string {
  return labels.presentation.lintRules[ruleId] ?? ruleId;
}
