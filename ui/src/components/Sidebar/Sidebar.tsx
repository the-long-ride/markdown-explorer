import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useLayoutEffect,
  useEffect,
} from "react";
import { useAppState } from "../../contexts/AppStateContext";
import { SearchIcon, FolderIcon } from "../shared/icons";
import { FileNode, FolderNodeView } from "./TreeNode";
import type { SidebarItemMenuTarget } from "./TreeNode";
import type { TreeOrderingProps } from "./TreeNode";
import { SidebarItemMenu } from "./SidebarItemMenu";
import { usePlatform } from "../../contexts/PlatformContext";
import { supportsShellLocation } from "../../desktop/shellLocation";
import { getTranslations } from "../../contexts/translations";
import { SidebarSearch } from "./SidebarSearch";
import type { SidebarSearchStatus } from "./SidebarSearch";
import { useSidebarCursorNavigation } from "./useSidebarCursorNavigation";
import { getEnabledShortcut } from "../../utils/shortcuts";
import { supportsLocalFileBrowserOpen } from "../../dom/localFileBrowserSupport";
import { buildSidebarItemMenuItems } from "./sidebarItemMenuItems";
import { folderHasVisibleContent, getWorkspaceScopeKey, matchesFileSearch } from "./sidebarTreeFiltering";
import { getActiveFolderPaths } from "./sidebarActiveFolders";
import { useLocateActiveFile } from "./useLocateActiveFile";
import { SidebarFilesActions } from "./SidebarFilesActions";
import { useFolderExpansionCommand } from "./useFolderExpansionCommand";
import { collectHoistedPinnedItems, orderSidebarLevel } from "./sidebarTreeOrdering";
import { useSidebarPinnedSorting } from "./useSidebarPinnedSorting";
import { useSidebarScopeFocus } from "./useSidebarScopeFocus";
import { SidebarScopeControls } from "./SidebarScopeControls";

interface SidebarProps {
  cursorMode?: boolean;
  onCursorModeClose?: () => void;
}

export function Sidebar({ cursorMode = false, onCursorModeClose }: SidebarProps) {
  const { state, updateSettings, dispatch, navigate } = useAppState();
  const bridge = usePlatform();
  const [filter, setFilter] = useState("");
  const [scopeFocusEditing, setScopeFocusEditing] = useState(false);
  const { folderExpansionCommand, collapseAllFolders, expandAllFolders } =
    useFolderExpansionCommand();
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

  const canRequestItemMenu = useCallback(() => true, []);

  const isFiles = state.sidebarActiveTab === "files";
  const isSearch = state.sidebarActiveTab === "search";
  useEffect(() => {
    if (!isFiles) setItemMenu(null);
  }, [isFiles]);
  const tabIndicatorRef = useRef<HTMLSpanElement>(null);

  const scrollToActiveFile = useCallback(() => {
    if (!state.currentFile) return;
    window.dispatchEvent(new CustomEvent("locate-active-file"));
  }, [state.currentFile]);

  const locateRequest = useLocateActiveFile(treeRef);

  const onFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setFilter(e.target.value),
    [],
  );

  const scopeKey = getWorkspaceScopeKey(state.workspacePath, state.workspaceName);
  const {
    pinnedKeys,
    sortMode,
    hasPins,
    pinLimitReached,
    clearPins,
    togglePin,
    setSortMode,
  } = useSidebarPinnedSorting({
    tree: state.tree,
    workspaceKey: scopeKey,
    settings: state.settings,
    updateSettings,
  });
  const treeOrdering = useMemo<TreeOrderingProps>(
    () => ({ pinnedKeys, sortMode }),
    [pinnedKeys, sortMode],
  );
  const {
    allFilePaths,
    selectedFilePaths,
    hideUnselected,
    hasScopeEntry,
    count: scopeFocusCount,
    allSelected: allFilesSelected,
    clear: clearScopeFocus,
    toggleAll: toggleAllScopeFiles,
    treeProps: scopeFocusTree,
  } = useSidebarScopeFocus({
    fileList: state.fileList,
    settings: state.settings,
    workspaceKey: scopeKey,
    editing: scopeFocusEditing,
    updateSettings,
  });
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
  const activeFolderPaths = useMemo(
    () => getActiveFolderPaths(state.currentFile, state.fileList),
    [state.currentFile, state.fileList],
  );

  const { hoistedFiles, hoistedFolders } = useMemo(
    () => (state.tree ? collectHoistedPinnedItems(state.tree, pinnedKeys) : { hoistedFiles: [], hoistedFolders: [] }),
    [state.tree, pinnedKeys],
  );

  const visibleRootFiles = useMemo(() => {
    const direct = state.tree?.files.filter(
      (file) => matchesFileSearch(file, filter)
        && (!hideUnselected || selectedFilePaths.has(file.fsPath)),
    ) ?? [];
    const hoisted = hoistedFiles.filter(
      (file) => matchesFileSearch(file, filter)
        && (!hideUnselected || selectedFilePaths.has(file.fsPath)),
    );
    return [...direct, ...hoisted];
  }, [state.tree, hoistedFiles, filter, hideUnselected, selectedFilePaths]);

  const visibleRootChildren = useMemo(() => {
    const direct = state.tree?.children.filter((child) =>
      folderHasVisibleContent(child, filter, hideUnselected, selectedFilePaths),
    ) ?? [];
    const hoisted = hoistedFolders.filter((child) =>
      folderHasVisibleContent(child, filter, hideUnselected, selectedFilePaths),
    );
    return [...direct, ...hoisted];
  }, [state.tree, hoistedFolders, filter, hideUnselected, selectedFilePaths]);

  const orderedRootItems = useMemo(
    () => orderSidebarLevel(visibleRootFiles, visibleRootChildren, {
      ...treeOrdering,
      showTitle: state.settings.showTitle,
    }),
    [state.settings.showTitle, treeOrdering, visibleRootChildren, visibleRootFiles],
  );
  const hasVisibleTreeItems = orderedRootItems.length > 0;

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

  const itemMenuItems = useMemo(() => buildSidebarItemMenuItems({
    state,
    target: itemMenu,
    canOpenHtmlInBrowser,
    canOpenItemLocations,
    translations: t,
    bridge,
    navigate,
    isPinned: itemMenu ? pinnedKeys.has(`${itemMenu.kind}:${itemMenu.path}`) : false,
    pinLimitReached,
    onTogglePin: togglePin,
  }), [
    bridge,
    canOpenHtmlInBrowser,
    canOpenItemLocations,
    itemMenu,
    navigate,
    pinLimitReached,
    pinnedKeys,
    state,
    t,
    togglePin,
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
          <SidebarFilesActions
            canLocate={Boolean(state.currentFile)}
            hasPins={hasPins}
            locateLabel={t.tooltips.locateFile}
            clearPinsLabel={t.sidebar.clearPinnedItems || "Clear all pinned items"}
            sortLabel={t.sidebar.sortFiles || "Sort files and folders"}
            sortNameAscLabel={t.sidebar.sortNameAsc || "Name: A–Z"}
            sortNameDescLabel={t.sidebar.sortNameDesc || "Name: Z–A"}
            sortModifiedDescLabel={t.sidebar.sortModifiedDesc || "Last modified: newest first"}
            sortModifiedAscLabel={t.sidebar.sortModifiedAsc || "Last modified: oldest first"}
            collapseLabel={t.sidebar.collapseAllFolders}
            expandLabel={t.sidebar.expandAllFolders}
            locateShortcut={getEnabledShortcut(state.settings, 'locateFile')}
            sortMode={sortMode}
            onLocate={scrollToActiveFile}
            onClearPins={clearPins}
            onSortChange={setSortMode}
            onCollapseAll={collapseAllFolders}
            onExpandAll={expandAllFolders}
          />
          <SidebarScopeControls
            editing={scopeFocusEditing}
            hasEntry={hasScopeEntry}
            count={scopeFocusCount}
            total={allFilePaths.length}
            allSelected={allFilesSelected}
            labels={{
              focus: t.sidebar.scopeFocus,
              clear: t.sidebar.clearScopeFocus,
              checkAll: t.sidebar.checkAll || "Check all",
              uncheckAll: t.sidebar.uncheckAll || "Uncheck all",
            }}
            onToggleEditing={() => setScopeFocusEditing((editing) => !editing)}
            onToggleAll={toggleAllScopeFiles}
            onClear={clearScopeFocus}
          />
        </div>
        <div
          className="sidebar__tree sidebar__tree--from-left"
          id="sidebarTree"
          role="tree"
          ref={treeRef}
          onScroll={handleScroll}
        >
          {orderedRootItems.map((item) => item.kind === "file" ? (
            <FileNode
              key={item.key}
              file={item.file}
              scopeFocus={scopeFocusTree}
              ordering={treeOrdering}
              cursorMode={cursorMode}
              cursorItemId={cursorItemId}
              onRequestItemMenu={handleRequestItemMenu}
              canRequestItemMenu={canRequestItemMenu}
              openMenuPath={itemMenu?.path ?? null}
              itemActionsLabel={t.sidebarItemActions}
              pinnedLabel={t.sidebar.pinned || "Pinned"}
            />
          ) : (
            <FolderNodeView
              key={item.key}
              node={item.folder}
              filter={filter}
              scopeFocus={scopeFocusTree}
              ordering={treeOrdering}
              cursorMode={cursorMode}
              cursorItemId={cursorItemId}
              onRequestItemMenu={handleRequestItemMenu}
              canRequestItemMenu={canRequestItemMenu}
              openMenuPath={itemMenu?.path ?? null}
              itemActionsLabel={t.sidebarItemActions}
              pinnedLabel={t.sidebar.pinned || "Pinned"}
              activeFolderPaths={activeFolderPaths}
              locateRequest={locateRequest}
              expansionCommand={folderExpansionCommand}
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
        <SidebarSearch
          isVisible={isSearch}
          onStatusChange={handleSearchStatus}
        />
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
