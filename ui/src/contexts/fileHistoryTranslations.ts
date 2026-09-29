import type { AppLanguage } from './languageOptions';

export interface FileHistoryTranslations {
  readonly title: string;
  readonly raw: string;
  readonly rendered: string;
  readonly inline: string;
  readonly split: string;
  readonly viewMode: string;
  readonly compare: string;
  readonly compareHint: string;
  readonly currentFile: string;
  readonly currentFileHint: string;
  readonly noFileHistory: string;
  readonly fileAdded: string;
  readonly renamedFrom: string;
  readonly filterCommits: string;
  readonly loadingDiff: string;
  readonly noChanges: string;
  readonly timeout: string;
  readonly close: string;
  readonly resizeList: string;
  readonly resizeSplit: string;
}

export const FILE_HISTORY_TRANSLATIONS: Record<AppLanguage, FileHistoryTranslations> = {
  en: {
    title: 'File history', raw: 'Raw', rendered: 'Rendered', inline: 'Inline', split: 'Split', viewMode: 'View',
    compare: 'Compare', compareHint: 'Pick two commits to compare them.', currentFile: 'Current file', currentFileHint: 'Your working copy, including unsaved edits',
    noFileHistory: 'No commits for this file yet.', fileAdded: 'File added in this commit', renamedFrom: 'Renamed from {path}',
    filterCommits: 'Filter commits', loadingDiff: 'Loading changes…', noChanges: 'No changes between these versions.',
    timeout: 'Git took too long to answer. Try again.', close: 'Close',
    resizeList: 'Resize commit list', resizeSplit: 'Resize diff panes',
  },
  vi: {
    title: 'Lịch sử tệp', raw: 'Mã nguồn', rendered: 'Xem trước', inline: 'Nội tuyến', split: 'Song song', viewMode: 'Chế độ xem',
    compare: 'So sánh', compareHint: 'Chọn hai commit để so sánh.', currentFile: 'Tệp hiện tại', currentFileHint: 'Bản làm việc hiện tại, bao gồm các thay đổi chưa lưu',
    noFileHistory: 'Tệp này chưa có commit nào.', fileAdded: 'Tệp được thêm trong commit này', renamedFrom: 'Đổi tên từ {path}',
    filterCommits: 'Lọc commit', loadingDiff: 'Đang tải thay đổi…', noChanges: 'Không có thay đổi giữa hai phiên bản.',
    timeout: 'Git phản hồi quá lâu. Hãy thử lại.', close: 'Đóng',
    resizeList: 'Kéo để chỉnh độ rộng danh sách commit', resizeSplit: 'Kéo để chỉnh độ rộng khung so sánh',
  },
  fr: {
    title: 'Historique du fichier', raw: 'Source', rendered: 'Aperçu', inline: 'Unifié', split: 'Côte à côte', viewMode: 'Affichage',
    compare: 'Comparer', compareHint: 'Choisissez deux commits à comparer.', currentFile: 'Fichier actuel', currentFileHint: 'Votre copie de travail, modifications non enregistrées comprises',
    noFileHistory: 'Aucun commit pour ce fichier.', fileAdded: 'Fichier ajouté dans ce commit', renamedFrom: 'Renommé depuis {path}',
    filterCommits: 'Filtrer les commits', loadingDiff: 'Chargement des modifications…', noChanges: 'Aucune différence entre ces versions.',
    timeout: 'Git a mis trop de temps à répondre. Réessayez.', close: 'Fermer',
    resizeList: 'Redimensionner la liste des commits', resizeSplit: 'Redimensionner les volets de comparaison',
  },
  es: {
    title: 'Historial del archivo', raw: 'Código fuente', rendered: 'Vista previa', inline: 'Unificado', split: 'Dividido', viewMode: 'Vista',
    compare: 'Comparar', compareHint: 'Elige dos commits para compararlos.', currentFile: 'Archivo actual', currentFileHint: 'Tu copia de trabajo, incluidos los cambios sin guardar',
    noFileHistory: 'Este archivo aún no tiene commits.', fileAdded: 'Archivo añadido en este commit', renamedFrom: 'Renombrado desde {path}',
    filterCommits: 'Filtrar commits', loadingDiff: 'Cargando cambios…', noChanges: 'No hay cambios entre estas versiones.',
    timeout: 'Git tardó demasiado en responder. Inténtalo de nuevo.', close: 'Cerrar',
    resizeList: 'Cambiar el ancho de la lista de commits', resizeSplit: 'Cambiar el ancho de los paneles de comparación',
  },
  zh: {
    title: '文件历史', raw: '源代码', rendered: '预览', inline: '内联', split: '并排', viewMode: '视图',
    compare: '比较', compareHint: '选择两个提交进行比较。', currentFile: '当前文件', currentFileHint: '当前工作副本，包含未保存的修改',
    noFileHistory: '此文件暂无提交记录。', fileAdded: '此提交中新增了该文件', renamedFrom: '由 {path} 重命名',
    filterCommits: '筛选提交', loadingDiff: '正在加载更改…', noChanges: '这两个版本之间没有更改。',
    timeout: 'Git 响应超时，请重试。', close: '关闭',
    resizeList: '调整提交列表宽度', resizeSplit: '调整对比窗格宽度',
  },
  no: {
    title: 'Filhistorikk', raw: 'Kildekode', rendered: 'Forhåndsvisning', inline: 'Samlet', split: 'Delt', viewMode: 'Visning',
    compare: 'Sammenlign', compareHint: 'Velg to commits for å sammenligne dem.', currentFile: 'Gjeldende fil', currentFileHint: 'Arbeidskopien din, inkludert ulagrede endringer',
    noFileHistory: 'Ingen commits for denne filen ennå.', fileAdded: 'Filen ble lagt til i denne commiten', renamedFrom: 'Omdøpt fra {path}',
    filterCommits: 'Filtrer commits', loadingDiff: 'Laster endringer…', noChanges: 'Ingen endringer mellom disse versjonene.',
    timeout: 'Git brukte for lang tid på å svare. Prøv igjen.', close: 'Lukk',
    resizeList: 'Endre bredden på commit-listen', resizeSplit: 'Endre bredden på sammenligningsrutene',
  },
  ja: {
    title: 'ファイル履歴', raw: 'ソース', rendered: 'プレビュー', inline: 'インライン', split: '左右分割', viewMode: '表示',
    compare: '比較', compareHint: '比較する 2 つのコミットを選択してください。', currentFile: '現在のファイル', currentFileHint: '未保存の変更を含む作業コピー',
    noFileHistory: 'このファイルにはまだコミットがありません。', fileAdded: 'このコミットでファイルが追加されました', renamedFrom: '{path} から名前変更',
    filterCommits: 'コミットを絞り込む', loadingDiff: '変更を読み込み中…', noChanges: 'これらのバージョン間に変更はありません。',
    timeout: 'Git の応答に時間がかかりすぎました。もう一度お試しください。', close: '閉じる',
    resizeList: 'コミット一覧の幅を変更', resizeSplit: '比較ペインの幅を変更',
  },
  ko: {
    title: '파일 기록', raw: '소스', rendered: '미리보기', inline: '인라인', split: '분할', viewMode: '보기',
    compare: '비교', compareHint: '비교할 커밋 두 개를 선택하세요.', currentFile: '현재 파일', currentFileHint: '저장하지 않은 변경을 포함한 작업 사본',
    noFileHistory: '이 파일에는 아직 커밋이 없습니다.', fileAdded: '이 커밋에서 파일이 추가되었습니다', renamedFrom: '{path}에서 이름 변경',
    filterCommits: '커밋 필터', loadingDiff: '변경 사항 불러오는 중…', noChanges: '두 버전 사이에 변경 사항이 없습니다.',
    timeout: 'Git 응답이 너무 오래 걸렸습니다. 다시 시도하세요.', close: '닫기',
    resizeList: '커밋 목록 너비 조정', resizeSplit: '비교 창 너비 조정',
  },
  ru: {
    title: 'История файла', raw: 'Исходник', rendered: 'Предпросмотр', inline: 'Единый', split: 'Раздельно', viewMode: 'Вид',
    compare: 'Сравнить', compareHint: 'Выберите два коммита для сравнения.', currentFile: 'Текущий файл', currentFileHint: 'Ваша рабочая копия, включая несохранённые правки',
    noFileHistory: 'У этого файла пока нет коммитов.', fileAdded: 'Файл добавлен в этом коммите', renamedFrom: 'Переименован из {path}',
    filterCommits: 'Фильтр коммитов', loadingDiff: 'Загрузка изменений…', noChanges: 'Между этими версиями нет изменений.',
    timeout: 'Git слишком долго не отвечал. Попробуйте снова.', close: 'Закрыть',
    resizeList: 'Изменить ширину списка коммитов', resizeSplit: 'Изменить ширину панелей сравнения',
  },
};

export function getFileHistoryTranslations(language?: string): FileHistoryTranslations {
  if (language && language in FILE_HISTORY_TRANSLATIONS) return FILE_HISTORY_TRANSLATIONS[language as AppLanguage];
  return FILE_HISTORY_TRANSLATIONS.en;
}
