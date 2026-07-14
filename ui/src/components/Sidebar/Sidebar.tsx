import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useLayoutEffect,
  useEffect,
} from "react";
import { useAppState } from "../../contexts/AppStateContext";
import { CheckIcon, CloseIcon, SearchIcon, LocateIcon, FolderIcon } from "../shared/icons";
import { TooltipButton } from "../shared/TooltipButton";
import { FileNode, FolderNodeView } from "./TreeNode";
import type { ScopeFocusTreeProps } from "./TreeNode";
import { getTranslations } from "../../contexts/translations";
import type { FolderNode, MdFile } from "../../types";
import { SidebarSearch } from "./SidebarSearch";
import type { SidebarSearchStatus } from "./SidebarSearch";

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

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select";
}

interface SidebarProps {
  cursorMode?: boolean;
  onCursorModeClose?: () => void;
}

export function Sidebar({ cursorMode = false, onCursorModeClose }: SidebarProps) {
  const { state, updateSettings, dispatch } = useAppState();
  const [filter, setFilter] = useState("");
  const [scopeFocusEditing, setScopeFocusEditing] = useState(false);
  const [cursorItemId, setCursorItemId] = useState<string | null>(null);
  const currentLang = state.settings.language || "en";
  const t = getTranslations(currentLang);

  const navRef = useRef<HTMLElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const scrollPosRef = useRef(0);
  const lastWorkspaceRef = useRef(state.workspaceName);

  // Search status reported by SidebarSearch
  const [searchStatus, setSearchStatus] = useState<SidebarSearchStatus>({
    isSearching: false,
    resultCount: 0,
    showCount: false,
  });

  const handleSearchStatus = useCallback((status: SidebarSearchStatus) => {
    setSearchStatus(status);
  }, []);

  const isFiles = state.sidebarActiveTab === "files";
  const isSearch = state.sidebarActiveTab === "search";

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

  const getCursorItems = useCallback((): HTMLElement[] => {
    const root = treeRef.current;
    if (!root) return [];
    return Array.from(
      root.querySelectorAll<HTMLElement>('[data-sidebar-cursor-item="true"]'),
    );
  }, []);

  useLayoutEffect(() => {
    if (!cursorMode) {
      setCursorItemId(null);
      return;
    }

    const items = getCursorItems();
    if (items.length === 0) {
      setCursorItemId(null);
      return;
    }

    const currentItem = cursorItemId
      ? items.find((item) => item.dataset.sidebarId === cursorItemId)
      : null;
    const activeFileItem = state.currentFile
      ? items.find(
          (item) =>
            item.dataset.sidebarKind === "file" &&
            item.dataset.sidebarId === state.currentFile,
        )
      : null;
    const nextItem = currentItem ?? activeFileItem ?? items[0];
    const nextId = nextItem.dataset.sidebarId ?? null;
    if (nextId !== cursorItemId) {
      setCursorItemId(nextId);
      return;
    }

    nextItem.focus({ preventScroll: true });
    nextItem.scrollIntoView({ block: "nearest" });
  }, [
    cursorItemId,
    cursorMode,
    filter,
    getCursorItems,
    hideUnselected,
    scopeFocusEditing,
    selectedFilePaths,
    state.currentFile,
    state.tree,
  ]);

  useEffect(() => {
    if (!cursorMode) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (isEditableTarget(event.target)) {
        if (event.key === "Escape") {
          event.preventDefault();
          onCursorModeClose?.();
        }
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCursorModeClose?.();
        return;
      }

      if (!["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) return;

      const items = getCursorItems();
      if (items.length === 0) return;

      event.preventDefault();
      event.stopPropagation();

      let index = cursorItemId
        ? items.findIndex((item) => item.dataset.sidebarId === cursorItemId)
        : -1;
      if (index < 0) {
        index = Math.max(
          0,
          items.findIndex((item) => item === document.activeElement),
        );
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const direction = event.key === "ArrowDown" ? 1 : -1;
        const nextIndex = Math.min(
          items.length - 1,
          Math.max(0, index + direction),
        );
        setCursorItemId(items[nextIndex]?.dataset.sidebarId ?? null);
        return;
      }

      const currentItem = items[index] ?? items[0];
      if (!currentItem) return;
      if (currentItem.dataset.sidebarKind === "file") {
        currentItem.click();
        onCursorModeClose?.();
        return;
      }

      currentItem.click();
      setCursorItemId(currentItem.dataset.sidebarId ?? null);
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [cursorItemId, cursorMode, getCursorItems, onCursorModeClose]);

  useEffect(() => {
    if (!cursorMode) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && navRef.current?.contains(target)) return;
      onCursorModeClose?.();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [cursorMode, onCursorModeClose]);

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
            className="sidebar__tab-indicator"
            style={{
              transform: isSearch ? "translateX(100%)" : "translateX(0)",
            }}
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
                shortcut={state.settings.keybindings?.locateFile}
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
              <div className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} />
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
    </nav>
  );
}
