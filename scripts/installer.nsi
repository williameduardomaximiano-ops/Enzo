!include "MUI2.nsh"
!include "x64.nsh"
!include "WinVer.nsh"
Name "ENZO"
InstallDir "$LOCALAPPDATA\Programs\ENZO"
InstallDirRegKey HKCU "Software\AgapeStudio\ENZO" "InstallDir"
RequestExecutionLevel user
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\ENZO.exe"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "PortugueseBR"
Function .onInit
 ${IfNot} ${RunningX64}
  MessageBox MB_ICONSTOP "ENZO exige Windows de 64 bits."
  Abort
 ${EndIf}
 ${IfNot} ${AtLeastWin10}
  MessageBox MB_ICONSTOP "ENZO exige Windows 10 ou mais recente."
  Abort
 ${EndIf}
FunctionEnd
Section "ENZO" SEC01
 SetOutPath "$INSTDIR"
 SetOverwrite on
 File /r "${PROJECT_DIR}/dist/win-unpacked/*"
 WriteUninstaller "$INSTDIR\Desinstalar ENZO.exe"
 WriteRegStr HKCU "Software\AgapeStudio\ENZO" "InstallDir" "$INSTDIR"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ENZO" "DisplayName" "ENZO"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ENZO" "DisplayVersion" "${VERSION}"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ENZO" "UninstallString" '$\"$INSTDIR\Desinstalar ENZO.exe$\"'
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ENZO" "Publisher" "Ágape Studio"
 CreateDirectory "$SMPROGRAMS\ENZO"
 CreateShortcut "$SMPROGRAMS\ENZO\ENZO.lnk" "$INSTDIR\ENZO.exe"
 CreateShortcut "$DESKTOP\ENZO.lnk" "$INSTDIR\ENZO.exe"
SectionEnd
Section "Uninstall"
 Delete "$DESKTOP\ENZO.lnk"
 Delete "$SMPROGRAMS\ENZO\ENZO.lnk"
 RMDir "$SMPROGRAMS\ENZO"
 ; Remove only files belonging to ENZO. Never delete user data or arbitrary folders.
 !include "${PROJECT_DIR}/scripts/uninstall-files.nsh"
 Delete "$INSTDIR\Desinstalar ENZO.exe"
 RMDir "$INSTDIR"
 DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ENZO"
 DeleteRegKey HKCU "Software\AgapeStudio\ENZO"
SectionEnd
