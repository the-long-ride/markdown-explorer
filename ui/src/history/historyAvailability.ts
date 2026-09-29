import type { AppLanguage } from '../contexts/languageOptions';

interface HistoryAvailabilityCopy {
  requirement: string;
  gitMissingHelp: string;
  repositoryMissingHelp: string;
  openWorkspace: string;
  revision: string;
}

const COPY: Record<AppLanguage, HistoryAvailabilityCopy> = {
  en: {
    requirement: 'History shows earlier file versions when Git is installed and this workspace tracks changes with Git.',
    gitMissingHelp: 'Install Git and reopen this workspace to use History.',
    repositoryMissingHelp: 'Open a workspace that tracks versions with Git, or ask the person who shared this folder to set it up.',
    openWorkspace: 'Open a workspace to check its version history.',
    revision: 'Revision (Git)',
  },
  vi: {
    requirement: 'Lịch sử hiển thị các phiên bản trước khi máy đã cài Git và thư mục làm việc theo dõi thay đổi bằng Git.',
    gitMissingHelp: 'Cài Git rồi mở lại thư mục làm việc để dùng Lịch sử.',
    repositoryMissingHelp: 'Mở thư mục đã theo dõi phiên bản bằng Git, hoặc nhờ người chia sẻ thư mục thiết lập Git.',
    openWorkspace: 'Mở một thư mục làm việc để kiểm tra lịch sử phiên bản.',
    revision: 'Phiên bản (Git)',
  },
  fr: {
    requirement: 'L’historique affiche les anciennes versions si Git est installé et que cet espace de travail suit les modifications avec Git.',
    gitMissingHelp: 'Installez Git puis rouvrez cet espace de travail pour utiliser l’historique.',
    repositoryMissingHelp: 'Ouvrez un espace de travail suivi par Git ou demandez à la personne qui l’a partagé de le configurer.',
    openWorkspace: 'Ouvrez un espace de travail pour vérifier son historique.',
    revision: 'Révision (Git)',
  },
  es: {
    requirement: 'El historial muestra versiones anteriores si Git está instalado y este espacio de trabajo registra los cambios con Git.',
    gitMissingHelp: 'Instala Git y vuelve a abrir este espacio de trabajo para usar el historial.',
    repositoryMissingHelp: 'Abre un espacio de trabajo con historial de Git o pide a quien compartió la carpeta que lo configure.',
    openWorkspace: 'Abre un espacio de trabajo para comprobar su historial.',
    revision: 'Revisión (Git)',
  },
  zh: {
    requirement: '安装 Git 且此工作区使用 Git 记录更改后，历史记录才会显示较早的文件版本。',
    gitMissingHelp: '安装 Git 后重新打开此工作区，即可使用历史记录。',
    repositoryMissingHelp: '打开使用 Git 记录版本的工作区，或请共享此文件夹的人进行设置。',
    openWorkspace: '打开工作区以检查其版本历史。',
    revision: '修订版本 (Git)',
  },
  no: {
    requirement: 'Historikk viser tidligere filversjoner når Git er installert og arbeidsområdet sporer endringer med Git.',
    gitMissingHelp: 'Installer Git og åpne arbeidsområdet på nytt for å bruke Historikk.',
    repositoryMissingHelp: 'Åpne et arbeidsområde som sporer versjoner med Git, eller be den som delte mappen om å sette det opp.',
    openWorkspace: 'Åpne et arbeidsområde for å sjekke versjonshistorikken.',
    revision: 'Revisjon (Git)',
  },
  ja: {
    requirement: 'Git がインストールされ、このワークスペースで変更を記録している場合、過去のファイル版を表示できます。',
    gitMissingHelp: 'Git をインストールしてからワークスペースを開き直してください。',
    repositoryMissingHelp: 'Git で変更を記録しているワークスペースを開くか、フォルダーの共有者に設定を依頼してください。',
    openWorkspace: 'ワークスペースを開いて変更履歴を確認してください。',
    revision: 'リビジョン (Git)',
  },
  ko: {
    requirement: 'Git이 설치되고 이 작업 공간에서 Git으로 변경 사항을 기록하면 이전 파일 버전을 볼 수 있습니다.',
    gitMissingHelp: 'Git을 설치한 뒤 작업 공간을 다시 열어 기록을 사용하세요.',
    repositoryMissingHelp: 'Git으로 버전을 기록하는 작업 공간을 열거나 폴더 공유자에게 설정을 요청하세요.',
    openWorkspace: '작업 공간을 열어 버전 기록을 확인하세요.',
    revision: '리비전 (Git)',
  },
  ru: {
    requirement: 'История показывает прежние версии файлов, если Git установлен и это рабочее пространство отслеживает изменения через Git.',
    gitMissingHelp: 'Установите Git и снова откройте рабочее пространство, чтобы использовать историю.',
    repositoryMissingHelp: 'Откройте пространство с историей Git или попросите владельца папки настроить её.',
    openWorkspace: 'Откройте рабочее пространство, чтобы проверить историю версий.',
    revision: 'Ревизия (Git)',
  },
};

export function getHistoryAvailabilityCopy(language?: string): HistoryAvailabilityCopy {
  return COPY[(language || 'en').toLowerCase() as AppLanguage] ?? COPY.en;
}

/** Turns a failed History load into a plain next step when Git or the repository is missing. */
export function getHistoryErrorHelp(error: string | null | undefined, language?: string): string | null {
  const copy = getHistoryAvailabilityCopy(language);
  const text = String(error ?? '');
  if (text === 'git-unavailable') return copy.gitMissingHelp;
  if (text === 'not-repository' || /not a git repository/i.test(text)) return copy.repositoryMissingHelp;
  return null;
}
