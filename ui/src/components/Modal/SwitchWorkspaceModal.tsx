// =============================================================================
// components/Modal/SwitchWorkspaceModal.tsx — Custom Switch Workspace Modal
// =============================================================================

import { useAppState } from '../../contexts/AppStateContext';

interface SwitchWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  targetPath: string;
}

const MODAL_TRANSLATIONS: Record<string, {
  title: string;
  message: string;
  currentWorkspace: string;
  newPath: string;
  switchBtn: string;
  cancelBtn: string;
}> = {
  en: {
    title: "Switch Workspace",
    message: 'Switch to "{0}"?',
    currentWorkspace: "Current workspace: {0}",
    newPath: "New path: {0}",
    switchBtn: "Switch",
    cancelBtn: "Cancel"
  },
  vi: {
    title: "Chuyển Không gian làm việc",
    message: 'Chuyển sang "{0}"?',
    currentWorkspace: "Không gian hiện tại: {0}",
    newPath: "Đường dẫn mới: {0}",
    switchBtn: "Chuyển",
    cancelBtn: "Hủy"
  },
  fr: {
    title: "Changer d'espace",
    message: 'Passer à "{0}"?',
    currentWorkspace: "Espace de travail actuel: {0}",
    newPath: "Nouveau chemin: {0}",
    switchBtn: "Changer",
    cancelBtn: "Annuler"
  },
  es: {
    title: "Cambiar Espacio",
    message: '¿Cambiar a "{0}"?',
    currentWorkspace: "Espacio de trabajo actual: {0}",
    newPath: "Nueva ruta: {0}",
    switchBtn: "Cambiar",
    cancelBtn: "Cancelar"
  },
  zh: {
    title: "切换工作区",
    message: '切换到 “{0}”？',
    currentWorkspace: "当前工作区：{0}",
    newPath: "新路径：{0}",
    switchBtn: "切换",
    cancelBtn: "取消"
  },
  no: {
    title: "Bytt arbeidsområde",
    message: 'Bytt til "{0}"?',
    currentWorkspace: "Nåværende arbeidsområde: {0}",
    newPath: "Ny sti: {0}",
    switchBtn: "Bytt",
    cancelBtn: "Avbryt"
  },
  ja: {
    title: "ワークスペースの切り替え",
    message: '"{0}" に切り替えますか？',
    currentWorkspace: "現在のワークスペース: {0}",
    newPath: "新しいパス: {0}",
    switchBtn: "切り替え",
    cancelBtn: "キャンセル"
  },
  ko: {
    title: "작업 공간 전환",
    message: '"{0}"(으)로 전환하시겠습니까?',
    currentWorkspace: "현재 작업 공간: {0}",
    newPath: "새 경로: {0}",
    switchBtn: "전환",
    cancelBtn: "취소"
  },
  ru: {
    title: "Сменить рабочую область",
    message: 'Переключиться на "{0}"?',
    currentWorkspace: "Текущая рабочая область: {0}",
    newPath: "Новый путь: {0}",
    switchBtn: "Переключить",
    cancelBtn: "Отмена"
  }
};

function getPathBasename(fullPath: string): string {
  if (!fullPath) return '';
  const parts = fullPath.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || fullPath;
}

export function SwitchWorkspaceModal({
  isOpen,
  onClose,
  onConfirm,
  targetPath,
}: SwitchWorkspaceModalProps) {
  const { state } = useAppState();

  if (!isOpen) return null;

  const currentLang = state.settings.language || 'en';
  const t = MODAL_TRANSLATIONS[currentLang] || MODAL_TRANSLATIONS.en;

  const currentWorkspaceName = state.workspaceName || 'current workspace';
  const targetWorkspaceName = getPathBasename(targetPath);

  const formatString = (str: string, replacement: string) => {
    return str.replace('{0}', replacement);
  };

  return (
    <div
      className="mdn-modal switch-workspace-modal"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="settings-card switch-workspace-card"
      >
        {/* Header */}
        <div className="switch-workspace-header">
          <div className="switch-workspace-header__icon">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              <path d="M12 11l4 4-4 4" />
              <path d="M8 15h8" />
            </svg>
          </div>
          <div>
            <h3>
              {t.title}
            </h3>
          </div>
        </div>

        {/* Message */}
        <div className="switch-workspace-message">
          {formatString(t.message, targetWorkspaceName)}
        </div>

        {/* Path Details Bento Box */}
        <div className="switch-workspace-paths">
          <div>
            {formatString(t.currentWorkspace, currentWorkspaceName)}
          </div>
          <div className="switch-workspace-paths__new">
            {formatString(t.newPath, targetPath)}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="switch-workspace-actions">
          <button
            type="button"
            className="segmented-option"
            onClick={onClose}
          >
            {t.cancelBtn}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="settings-download-update-btn switch-workspace-confirm"
          >
            <span>{t.switchBtn}</span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
