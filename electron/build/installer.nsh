!include "nsDialogs.nsh"

!ifndef BUILD_UNINSTALLER
Var ME_CreateDesktopShortcut
Var ME_AddMarkdownContext
Var ME_AddFolderContext
Var ME_DesktopShortcutCheckbox
Var ME_MarkdownContextCheckbox
Var ME_FolderContextCheckbox

!macro customInit
  ; Keep silent installs compatible with the previous checked-by-default
  ; shortcut behavior; the custom page can override these choices interactively.
  StrCpy $ME_CreateDesktopShortcut ${BST_CHECKED}
  StrCpy $ME_AddMarkdownContext ${BST_CHECKED}
  StrCpy $ME_AddFolderContext ${BST_CHECKED}
!macroend

!macro customPageAfterChangeDir
  Page custom MarkdownExplorerOptions MarkdownExplorerOptionsLeave
!macroend

Function MarkdownExplorerOptions
  nsDialogs::Create 1018
  Pop $0

  ${NSD_CreateCheckbox} 0 8u 100% 12u "Create desktop shortcut"
  Pop $ME_DesktopShortcutCheckbox
  ${NSD_Check} $ME_DesktopShortcutCheckbox

  ${NSD_CreateCheckbox} 0 32u 100% 24u "Add Markdown Explorer to .md and .mdx context menus"
  Pop $ME_MarkdownContextCheckbox
  ${NSD_Check} $ME_MarkdownContextCheckbox

  ${NSD_CreateCheckbox} 0 64u 100% 24u "Add Open Folder in Markdown Explorer to File Explorer"
  Pop $ME_FolderContextCheckbox
  ${NSD_Check} $ME_FolderContextCheckbox

  nsDialogs::Show
FunctionEnd

Function MarkdownExplorerOptionsLeave
  ${NSD_GetState} $ME_DesktopShortcutCheckbox $ME_CreateDesktopShortcut
  ${NSD_GetState} $ME_MarkdownContextCheckbox $ME_AddMarkdownContext
  ${NSD_GetState} $ME_FolderContextCheckbox $ME_AddFolderContext
FunctionEnd

!macro customInstall
  ${If} $ME_CreateDesktopShortcut == ${BST_CHECKED}
    CreateShortCut "$DESKTOP\${PRODUCT_FILENAME}.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  ${EndIf}

  ${If} $ME_AddMarkdownContext == ${BST_CHECKED}
    WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.md\shell\MarkdownExplorer" "" "Open with Markdown Explorer"
    WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.md\shell\MarkdownExplorer" "Icon" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}",0'
    WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.md\shell\MarkdownExplorer\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
    WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.mdx\shell\MarkdownExplorer" "" "Open with Markdown Explorer"
    WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.mdx\shell\MarkdownExplorer" "Icon" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}",0'
    WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.mdx\shell\MarkdownExplorer\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
  ${EndIf}

  ${If} $ME_AddFolderContext == ${BST_CHECKED}
    WriteRegStr HKCU "Software\Classes\Directory\shell\MarkdownExplorer" "" "Open Folder in Markdown Explorer"
    WriteRegStr HKCU "Software\Classes\Directory\shell\MarkdownExplorer" "Icon" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}",0'
    WriteRegStr HKCU "Software\Classes\Directory\shell\MarkdownExplorer\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
    WriteRegStr HKCU "Software\Classes\Directory\Background\shell\MarkdownExplorer" "" "Open Folder in Markdown Explorer"
    WriteRegStr HKCU "Software\Classes\Directory\Background\shell\MarkdownExplorer" "Icon" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}",0'
    WriteRegStr HKCU "Software\Classes\Directory\Background\shell\MarkdownExplorer\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%V"'
  ${EndIf}
!macroend
!endif

!macro customUnInstall
  Delete "$DESKTOP\${PRODUCT_FILENAME}.lnk"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.md\shell\MarkdownExplorer"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.mdx\shell\MarkdownExplorer"
  DeleteRegKey HKCU "Software\Classes\Directory\shell\MarkdownExplorer"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\MarkdownExplorer"
!macroend
