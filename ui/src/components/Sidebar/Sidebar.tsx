import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useLayoutEffect,
  useEffect,
} from "react";
import { useAppState } from "../../contexts/AppStateContext";
import { normalizePathKey } from "../../contexts/appStateReducer";
import {
  CheckIcon,
  CloseIcon,
  SearchIcon,
  LocateIcon,
  FolderIcon,
  OpenFolderLocationIcon,
  RevealFileLocationIcon,
  InternetIcon,
  HtmlPreviewIcon,
  MarkdownViewIcon,
} from "../shared/icons";
import { TooltipButton } from "../shared/TooltipButton";
import { FileNode, FolderNodeView } from "./TreeNode";
import type { ScopeFocusTreeProps, SidebarItemMenuTarget } from "./TreeNode";
import { SidebarItemMenu } from "./SidebarItemMenu";
import type { SidebarItemMenuItem } from "./SidebarItemMenu";
import { usePlatform } from "../../contexts/PlatformContext";
import { getShellLocationLabel, requestShellLocation, resolveWorkspaceFolderPath, supportsShellLocation } from "../../desktop/shellLocation";
import { getTranslations } from "../../contexts/translations";
import type { FolderNode, MdFile } from "../../types";
import { SidebarSearch } from "./SidebarSearch";
import type { SidebarSearchStatus } from "./SidebarSearch";
import { useSidebarCursorNavigation } from "./useSidebarCursorNavigation";
import { getEnabledShortcut } from "../../utils/shortcuts";
import { openLocalFileInBrowser } from "../../dom/htmlPreviewActions";
import { supportsLocalFileBrowserOpen } from "../../dom/localFileBrowserSupport";
import { isHtmlDocumentPath } from "../Content/HtmlDocumentView";

function getWorkspaceScopeKey(
  workspacePath: string | undefined,
  workspaceName: string,
): string {
  return workspacePath || workspaceName || "default";
}

function matchesFileSearch(file: MdFile, filter: string): boolean {
  const q = filter.toLowerCase().trim();
  if (!q) return true;
  return (
    file.title.toLowerCase().includes(q) ||
    file.relativePath.toLowerCase().includes(q)
  );
}

function folderHasVisibleContent(
  node: FolderNode,
  filter: string,
  hideUnselected: boolean,
  selectedFilePaths: Set<string>,
): boolean {
  return (
    node.files.some(
      (file) =>
        matchesFileSearch(file, filter) &&
        (!hideUnselected || selectedFilePaths.has(file.fsPath)),
    ) ||
    node.children.some((child) =>
      folderHasVisibleContent(child, filter, hideUnselected, selectedFilePaths),
    )
  );
}

interface SidebarProps {
  cursorMode?: boolean;
  onCursorModeClose?: () => void;
}

export function Sidebar({ cursorMode = false, onCursorModeClose }: SidebarProps) {
  const { state, updateSettings, dispatch, navigate } = useAppState();
  const bridge = usePlatform();
  const [filter, setFilter] = useState("");
  const [scopeFocusEditing, setScopeFocusEditing] = useState(false);
  const currentLang = state.settings.language || "en";
  const t = getTranslations(currentLang);

  const navRef = useRef<HTMLElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const scrollPosRef = useRef(0);
  const lastWorkspaceRef = useRef(state.workspaceName);
  const [itemMenu, setItemMenu] = useState<SidebarItemMenuTarget | null>(null);
  const canOpenItemLocations = supportsShellLocation(state.appRuntime);
  const canOpenHtmlInBrowser = supportsLocalFileBrowserOpen(state.appRuntime);

  // Search status reported by SidebarSearch
  const [searchStatus, setSearchStatus] = useState<SidebarSearchStatus>({
    isSearching: false,
    resultCount: 0,
    showCount: false,
  });

  const handleSearchStatus = useCallback((status: SidebarSearchStatus) => {
    setSearchStatus(status);
  }, []);

  const handleRequestItemMenu = useCallback((target: SidebarItemMenuTarget) => {
    setItemMenu((current) => current?.path === target.path ? null : target);
  }, []);

  const canRequestItemMenu = useCallback(
    (target: Pick<SidebarItemMenuTarget, "kind" | "path">) =>
      canOpenItemLocations || (target.kind === "file" && isHtmlDocumentPath(target.path)),
    [canOpenItemLocations],
  );

  const isFiles = state.sidebarActiveTab === "files";
  const isSearch = state.sidebarActiveTab === "search";
  useEffect(() => {
    if (!isFiles || (itemMenu && !canRequestItemMenu(itemMenu))) setItemMenu(null);
  }, [canRequestItemMenu, isFiles, itemMenu]);
  const tabIndicatorRef = useRef<HTMLSpanElement>(null);

  const scrollToActiveFile = useCallback(() => {
    if (!state.currentFile) return;
    window.dispatchEvent(new CustomEvent("locate-active-file"));
  }, [state.currentFile]);

  // Listen for locate-active-file event (dispatched by button OR keyboard shortcut)
  // and scroll the tree to the active item after folders have had a chance to expand.
  useEffect(() => {
    const handleLocateScroll = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const activeEl = treeRef.current?.querySelector(".tree-file.is-active");
          if (activeEl) {
            activeEl.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        });
      });
    };
    window.addEventListener("locate-active-file", handleLocateScroll);
    return () => window.removeEventListener("locate-active-file", handleLocateScroll);
  }, []);

  const onFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setFilter(e.target.value),
    [],
  );

  const scopeKey = getWorkspaceScopeKey(state.workspacePath, state.workspaceName);
  const scopeFocusMap = state.settings.scopeFocus ?? {};
  const hasScopeEntry = Object.prototype.hasOwnProperty.call(scopeFocusMap, scopeKey);
  const allFilePaths = useMemo(
    () => state.fileList.map((file) => file.fsPath),
    [state.fileList],
  );
  const allFilePathSet = useMemo(() => new Set(allFilePaths), [allFilePaths]);
  const storedScopePaths = scopeFocusMap[scopeKey] ?? [];
  const selectedFilePaths = useMemo(() => {
    if (!hasScopeEntry) return new Set(allFilePaths);
    return new Set(storedScopePaths.filter((filePath) => allFilePathSet.has(filePath)));
  }, [allFilePathSet, allFilePaths, hasScopeEntry, storedScopePaths]);
  const hideUnselected =
    hasScopeEntry &&
    !scopeFocusEditing &&
    selectedFilePaths.size < allFilePaths.length;
  const cursorItemId = useSidebarCursorNavigation({
    cursorMode,
    currentFile: state.currentFile,
    treeRef,
    filter,
    hideUnselected,
    scopeFocusEditing,
    selectedFilePaths,
    onCursorModeClose,
  });
  const scopeFocusCount = hasScopeEntry ? selectedFilePaths.size : allFilePaths.length;
  const allFilesSelected = allFilePaths.length > 0 && selectedFilePaths.size === allFilePaths.length;
  const bulkScopeActionLabel = allFilesSelected
    ? t.sidebar.uncheckAll || "Uncheck all"
    : t.sidebar.checkAll || "Check all";

  const updateScopeFocusPaths = useCallback(
    (nextPaths: Iterable<string>) => {
      const normalized = [...new Set(nextPaths)].filter((filePath) =>
        allFilePathSet.has(filePath),
      );
      const nextScopeFocus = { ...(state.settings.scopeFocus ?? {}) };
      if (normalized.length >= allFilePaths.length) {
        delete nextScopeFocus[scopeKey];
      } else {
        nextScopeFocus[scopeKey] = normalized;
      }
      updateSettings({ scopeFocus: nextScopeFocus });
    },
    [
      allFilePathSet,
      allFilePaths.length,
      scopeKey,
      state.settings.scopeFocus,
      updateSettings,
    ],
  );

  const handleScopeFileChange = useCallback(
    (filePath: string, checked: boolean) => {
      const nextSelection = new Set(hasScopeEntry ? selectedFilePaths : allFilePaths);
      if (checked) nextSelection.add(filePath);
      else nextSelection.delete(filePath);
      updateScopeFocusPaths(nextSelection);
    },
    [allFilePaths, hasScopeEntry, selectedFilePaths, updateScopeFocusPaths],
  );

  const handleScopeFolderChange = useCallback(
    (filePaths: readonly string[], checked: boolean) => {
      const nextSelection = new Set(hasScopeEntry ? selectedFilePaths : allFilePaths);
      for (const filePath of filePaths) {
        if (checked) nextSelection.add(filePath);
        else nextSelection.delete(filePath);
      }
      updateScopeFocusPaths(nextSelection);
    },
    [allFilePaths, hasScopeEntry, selectedFilePaths, updateScopeFocusPaths],
  );

  const clearScopeFocus = useCallback(() => {
    const nextScopeFocus = { ...(state.settings.scopeFocus ?? {}) };
    delete nextScopeFocus[scopeKey];
    updateSettings({ scopeFocus: nextScopeFocus });
  }, [scopeKey, state.settings.scopeFocus, updateSettings]);

  const toggleAllScopeFiles = useCallback(() => {
    updateScopeFocusPaths(allFilesSelected ? [] : allFilePaths);
  }, [allFilePaths, allFilesSelected, updateScopeFocusPaths]);

  const scopeFocusTree = useMemo<ScopeFocusTreeProps>(
    () => ({
      editing: scopeFocusEditing,
      hideUnselected,
      selectedFilePaths,
      onFileChange: handleScopeFileChange,
      onFolderChange: handleScopeFolderChange,
    }),
    [
      handleScopeFileChange,
      handleScopeFolderChange,
      hideUnselected,
      scopeFocusEditing,
      selectedFilePaths,
    ],
  );

  const visibleRootFiles = state.tree?.files.filter(
    (file) =>
      matchesFileSearch(file, filter) &&
      (!hideUnselected || selectedFilePaths.has(file.fsPath)),
  ) ?? [];
  const visibleRootChildren = state.tree?.children.filter((child) =>
    folderHasVisibleContent(child, filter, hideUnselected, selectedFilePaths),
  ) ?? [];
  const hasVisibleTreeItems = visibleRootFiles.length > 0 || visibleRootChildren.length > 0;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    scrollPosRef.current = e.currentTarget.scrollTop;
  }, []);

  useLayoutEffect(() => {
    if (treeRef.current && isFiles) {
      if (lastWorkspaceRef.current !== state.workspaceName) {
        lastWorkspaceRef.current = state.workspaceName;
        scrollPosRef.current = 0;
        treeRef.current.scrollTop = 0;
      } else {
        treeRef.current.scrollTop = scrollPosRef.current;
      }
    }
  }, [state.tree, state.workspaceName, isFiles]);

  const itemMenuItems = useMemo<readonly SidebarItemMenuItem[]>(() => {
    if (!itemMenu) return [];
    const items: SidebarItemMenuItem[] = [];
    const itemIsHtml = itemMenu.kind === "file" && isHtmlDocumentPath(itemMenu.path);

    if (itemIsHtml) {
      const targetPathKey = normalizePathKey(itemMenu.path);
      const matchingTab = state.contentTabs.find(
        (tab) => normalizePathKey(tab.filePath) === targetPathKey,
      );
      const currentOverride =
        normalizePathKey(state.currentFile ?? "") === targetPathKey
          ? state.currentHtmlPreviewOverride
          : undefined;
      const htmlPreviewEnabled =
        matchingTab?.htmlPreviewOverride
        ?? currentOverride
        ?? state.settings.defaultHtmlPreview;

      if (canOpenHtmlInBrowser) {
        items.push({
          id: "open-in-browser",
          label: t.openInBrowser,
          icon: <InternetIcon />,
          onSelect: () => {
            if (!openLocalFileInBrowser(bridge, itemMenu.path)) {
              window.dispatchEvent(new CustomEvent("markdown-explorer-action-notice", {
                detail: t.previewActions.openError,
              }));
            }
          },
        });
      }

      items.push({
        id: "toggle-html-preview",
        label: htmlPreviewEnabled ? t.showMarkdownView : t.showHtmlPreview,
        icon: htmlPreviewEnabled ? <MarkdownViewIcon /> : <HtmlPreviewIcon />,
        shortcut: getEnabledShortcut(state.settings, "toggleHtmlPreview"),
        onSelect: () =>
          navigate(itemMenu.path, { htmlPreviewOverride: !htmlPreviewEnabled }),
      });
    }

    if (canOpenItemLocations) {
      items.push({
        id: "open-location",
        label: getShellLocationLabel(t, state.hostPlatform, itemMenu.kind),
        icon: itemMenu.kind === "file"
          ? <RevealFileLocationIcon />
          : <OpenFolderLocationIcon />,
        shortcut: itemMenu.kind === "file"
          ? getEnabledShortcut(state.settings, "openCurrentDocumentLocation")
          : undefined,
        dividerBefore: items.length > 0,
        onSelect: () => {
          if (itemMenu.kind === "file") {
            requestShellLocation(bridge, itemMenu.path, "reveal-file");
          } else {
            requestShellLocation(
              bridge,
              resolveWorkspaceFolderPath(
                state.workspacePath || "",
                itemMenu.path,
                state.hostPlatform,
              ),
              "open-directory",
            );
          }
        },
      });
    }

    return items;
  }, [
    bridge,
    canOpenHtmlInBrowser,
    canOpenItemLocations,
    itemMenu,
    navigate,
    state.contentTabs,
    state.currentFile,
    state.currentHtmlPreviewOverride,
    state.hostPlatform,
    state.settings,
    state.workspacePath,
    t,
  ]);

  if (!state.tree) return null;

  return (
    <nav
      ref={navRef}
      className={`sidebar${state.sidebarCollapsed ? " is-collapsed" : ""}${cursorMode ? " is-cursor-mode" : ""}`}
      id="sidebar"
      aria-label={
        cursorMode ? "File navigation, cursor mode active" : "File navigation"
      }
    >
      {/* Shared title row — always rendered for smooth indicator slide */}
      <div className="sidebar__title-row">
        <div className="sidebar__tab-strip">
          <button
            type="button"
            className={`sidebar__tab-btn sidebar__tab-btn--files${isFiles ? " is-active" : ""}`}
            onClick={() =>
              dispatch({ type: "SET_SIDEBAR_ACTIVE_TAB", tab: "files" })
            }
          >
            <FolderIcon size={14} />
            <span>{t.sidebar.files}</span>
          </button>
          <button
            type="button"
            className={`sidebar__tab-btn${isSearch ? " is-active" : ""}`}
            onClick={() =>
              dispatch({ type: "SET_SIDEBAR_ACTIVE_TAB", tab: "search" })
            }
          >
            <SearchIcon size={14} />
            <span>{t.sidebar.search || "Search"}</span>
          </button>
          <span
            className={`sidebar__tab-indicator${isSearch ? ' is-search' : ''}`}
            ref={tabIndicatorRef}
          />
        </div>

        {/* Fading title actions — keyed to trigger animation on tab switch */}
        {isFiles ? (
          <div className="sidebar__title-actions" key="files-actions">
            {state.currentFile && (
              <TooltipButton
                type="button"
                className="sidebar__locate-btn"
                onClick={scrollToActiveFile}
                tooltip={t.tooltips.locateFile}
                shortcut={getEnabledShortcut(state.settings, 'locateFile')}
                tooltipPos="below"
                tooltipAlign="right"
                icon={<LocateIcon size={12} />}
              />
            )}
            <span className="sidebar__count" id="fileCount">
              {state.fileList.length}
            </span>
          </div>
        ) : (
          <div className="sidebar__title-actions" key="search-actions">
            {searchStatus.isSearching && (
              <div className="spinner sidebar__search-spinner" />
            )}
            {searchStatus.showCount && (
              <span className="sidebar__count">{searchStatus.resultCount}</span>
            )}
          </div>
        )}
      </div>

      {/* Tab content — directional slide animation */}
      <div
        className={`sidebar__tab-panel${!isFiles ? " is-hidden" : ""}`}
      >
        <div className="sidebar__header-fields">
          <div className="sidebar__search">
            <SearchIcon size={15} />
            <input
              type="text"
              placeholder={t.sidebar.filterPlaceholder}
              autoComplete="off"
              value={filter}
              onChange={onFilterChange}
              aria-label={t.sidebar.filterAriaLabel}
            />
          </div>
          <div className="sidebar__scope">
            <button
              type="button"
              className={`sidebar__scope-btn${scopeFocusEditing || hasScopeEntry ? " is-active" : ""}`}
              onClick={() => setScopeFocusEditing((editing) => !editing)}
              aria-pressed={scopeFocusEditing}
            >
              <span>{t.sidebar.scopeFocus}</span>
              <span className="sidebar__scope-count">
                {scopeFocusCount}/{allFilePaths.length}
              </span>
            </button>
            {scopeFocusEditing && allFilePaths.length > 0 && (
              <TooltipButton
                type="button"
                className="sidebar__scope-toggle-all"
                onClick={toggleAllScopeFiles}
                tooltip={bulkScopeActionLabel}
                label={bulkScopeActionLabel}
                aria-label={bulkScopeActionLabel}
                tooltipPos="below"
                tooltipAlign="right"
                icon={allFilesSelected ? <CloseIcon size={13} /> : <CheckIcon size={13} />}
              />
            )}
            {hasScopeEntry && (
              <TooltipButton
                type="button"
                className="sidebar__scope-clear"
                onClick={clearScopeFocus}
                tooltip={t.sidebar.clearScopeFocus}
                tooltipPos="below"
                tooltipAlign="right"
                icon={<CloseIcon size={12} />}
              />
            )}
          </div>
        </div>
        <div
          className="sidebar__tree sidebar__tree--from-left"
          id="sidebarTree"
          role="tree"
          ref={treeRef}
          onScroll={handleScroll}
        >
          {visibleRootFiles.map((f) => (
            <FileNode
              key={f.fsPath}
              file={f}
              scopeFocus={scopeFocusTree}
              cursorMode={cursorMode}
              cursorItemId={cursorItemId}
              onRequestItemMenu={handleRequestItemMenu}
              canRequestItemMenu={canRequestItemMenu}
              openMenuPath={itemMenu?.path ?? null}
              itemActionsLabel={t.sidebarItemActions}
            />
          ))}
          {visibleRootChildren.map((child) => (
            <FolderNodeView
              key={child.path}
              node={child}
              filter={filter}
              scopeFocus={scopeFocusTree}
              cursorMode={cursorMode}
              cursorItemId={cursorItemId}
              onRequestItemMenu={handleRequestItemMenu}
              canRequestItemMenu={canRequestItemMenu}
              openMenuPath={itemMenu?.path ?? null}
              itemActionsLabel={t.sidebarItemActions}
            />
          ))}
          {!hasVisibleTreeItems && (
            <div className="sidebar__empty-scope">
              {hasScopeEntry ? t.sidebar.noScopeFiles : t.sidebar.noFiles}
            </div>
          )}
        </div>
      </div>

      <div
        className={`sidebar__tab-panel${!isSearch ? " is-hidden" : ""}`}
      >
        <SidebarSearch isVisible={isSearch} onStatusChange={handleSearchStatus} />
      </div>
      {itemMenu && navRef.current && itemMenuItems.length > 0 && (
        <SidebarItemMenu
          anchor={itemMenu.anchor}
          sidebar={navRef.current}
          menuLabel={t.sidebarItemActions.replace(
            "{name}",
            itemMenu.path.split(/[\\/]/).filter(Boolean).pop() ?? itemMenu.path,
          )}
          items={itemMenuItems}
          onClose={() => setItemMenu(null)}
        />
      )}
    </nav>
  );
}
