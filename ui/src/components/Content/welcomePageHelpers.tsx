import { formatShortcutLabel } from '../../utils/shortcuts';
import {
  ChartIcon,
  FolderIcon,
  LightbulbIcon,
  ModalIcon,
  SearchIcon,
  WrenchIcon,
} from './WelcomePageIcons';

export const getTipIcon = (index: number) => {
  switch (index) {
    case 0: return <SearchIcon className="tip-icon" />;
    case 1: return <WrenchIcon className="tip-icon" />;
    case 2: return <FolderIcon className="tip-icon" />;
    case 3: return <ChartIcon className="tip-icon" />;
    case 4: return <ModalIcon className="tip-icon" />;
    default: return <LightbulbIcon className="tip-icon" />;
  }
};

export const renderShortcutKeys = (shortcutStr: string) => {
  if (!shortcutStr) return null;
  const parts = formatShortcutLabel(shortcutStr).split('+');
  return (
    <span className="shortcut-keys-wrapper">
      {parts.map((part, index) => (
        <span className="shortcut-keys-wrapper__part" key={`${part}-${index}`}>
          {index > 0 && <span className="shortcut-keys-wrapper__plus">+</span>}
          <kbd>{part}</kbd>
        </span>
      ))}
    </span>
  );
};
