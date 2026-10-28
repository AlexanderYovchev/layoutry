import { powershell, psString } from "./windows";

/**
 * Drives the genuine Windows common file dialogs (IFileOpenDialog /
 * IFileSaveDialog) that Layoutry's main process shows — no mocks.
 *
 * Plain Win32, never localized captions: the dialog is the process's
 * visible #32770 window holding the file-name Edit (control id 1001 in the
 * Save dialog, inside ComboBox 1148 in the Open dialog, Edit 1152 "Folder:"
 * in the folder picker used by code export). The path is typed
 * as WM_CHAR messages (WM_SETTEXT alone doesn't update the dialog's own
 * model) and read back with WM_GETTEXT, then WM_COMMAND IDOK (1) or
 * IDCANCEL (2) is posted to the dialog. (UI Automation exposes these
 * controls only as panes without Value/Invoke patterns.)
 */
const DIALOGS = `
if (-not ('LayoutryDialogs' -as [type])) {
  Add-Type @"
using System;
using System.Collections.Generic;
using System.Text;
using System.Runtime.InteropServices;
public static class LayoutryDialogs {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback, IntPtr lParam);
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr parent, EnumProc callback, IntPtr lParam);
  [DllImport("user32.dll")] static extern int GetClassName(IntPtr hWnd, StringBuilder name, int max);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int max);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] static extern int GetDlgCtrlID(IntPtr hWnd);
  [DllImport("user32.dll")] static extern IntPtr GetParent(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr SendMessage(IntPtr hWnd, uint msg, IntPtr wParam, string lParam);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr SendMessage(IntPtr hWnd, uint msg, IntPtr wParam, StringBuilder lParam);
  static string ClassOf(IntPtr h) { var b = new StringBuilder(64); GetClassName(h, b, 64); return b.ToString(); }
  public static string Title(IntPtr h) { var b = new StringBuilder(256); GetWindowText(h, b, 256); return b.ToString(); }
  public static IntPtr[] Dialogs(uint targetPid) {
    var found = new List<IntPtr>();
    EnumWindows((h, l) => {
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (pid == targetPid && IsWindowVisible(h) && ClassOf(h) == "#32770") found.Add(h);
      return true;
    }, IntPtr.Zero);
    return found.ToArray();
  }
  public static IntPtr NameBox(IntPtr dialog) {
    IntPtr result = IntPtr.Zero;
    EnumChildWindows(dialog, (h, l) => {
      if (ClassOf(h) != "Edit") return true;
      int id = GetDlgCtrlID(h);
      int parentId = GetDlgCtrlID(GetParent(h));
      if (id == 1001 || id == 1148 || id == 1152 || parentId == 1001 || parentId == 1148) { result = h; return false; }
      return true;
    }, IntPtr.Zero);
    return result;
  }
  [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
  /** Selects everything, then "types" each character (WM_CHAR), so the dialog sees real edits. */
  public static void TypeText(IntPtr h, string text) {
    SendMessage(h, 0x00B1, IntPtr.Zero, (IntPtr)(-1));
    foreach (char c in text) SendMessage(h, 0x0102, (IntPtr)c, IntPtr.Zero);
  }
  public static string GetText(IntPtr h) { var b = new StringBuilder(4096); SendMessage(h, 0x000D, (IntPtr)4096, b); return b.ToString(); }
  /** The folder picker's breadcrumb, e.g. "Address: Site" (ToolbarWindow32 1001). */
  public static string AddressText(IntPtr dialog) {
    string result = "";
    EnumChildWindows(dialog, (h, l) => {
      if (ClassOf(h) == "ToolbarWindow32" && GetDlgCtrlID(h) == 1001) { result = Title(h); return false; }
      return true;
    }, IntPtr.Zero);
    return result;
  }
}
"@
}
function Find-FileDialog([uint32]$TargetPid) {
  foreach ($h in [LayoutryDialogs]::Dialogs($TargetPid)) {
    if ([LayoutryDialogs]::NameBox($h) -ne [IntPtr]::Zero) { return $h }
  }
  return [IntPtr]::Zero
}
`;

export interface FileDialogResult {
  found: boolean;
  /** The dialog's title, e.g. "Save Project" (set by Layoutry). */
  title: string;
}

function parse(json: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(json);
  if (typeof parsed !== "object" || parsed === null) throw new Error(json);
  return Object.fromEntries(Object.entries(parsed));
}

/**
 * Waits for the file dialog, types `filePath` into its file-name box and
 * presses Save/Open — or presses Cancel when `filePath` is null. Never
 * presses Save/Open unless the box really holds `filePath`, so a test can't
 * write into the user's real Documents folder by accident.
 */
export function answerFileDialog(
  pid: number,
  filePath: string | null,
  timeoutSeconds = 15,
): FileDialogResult {
  const result = parse(
    powershell(`${DIALOGS}
$deadline = (Get-Date).AddSeconds(${timeoutSeconds})
$dialog = [IntPtr]::Zero
while ($dialog -eq [IntPtr]::Zero -and (Get-Date) -lt $deadline) {
  $dialog = Find-FileDialog ${pid}
  if ($dialog -eq [IntPtr]::Zero) { Start-Sleep -Milliseconds 200 }
}
if ($dialog -eq [IntPtr]::Zero) { @{ found = $false; title = '' } | ConvertTo-Json -Compress; exit }
$title = [LayoutryDialogs]::Title($dialog)
$path = ${filePath === null ? "$null" : psString(filePath)}
if ($path) {
  $box = [LayoutryDialogs]::NameBox($dialog)
  [LayoutryDialogs]::TypeText($box, $path)
  $typed = [LayoutryDialogs]::GetText($box)
  if ($typed -ne $path) {
    [void][LayoutryDialogs]::PostMessage($dialog, 0x0111, [IntPtr]2, [IntPtr]::Zero)
    throw "File name box holds '$typed', not the requested path; cancelled the dialog"
  }
  [void][LayoutryDialogs]::PostMessage($dialog, 0x0111, [IntPtr]1, [IntPtr]::Zero)
} else {
  [void][LayoutryDialogs]::PostMessage($dialog, 0x0111, [IntPtr]2, [IntPtr]::Zero)
}
@{ found = $true; title = $title } | ConvertTo-Json -Compress`),
  );
  return { found: result.found === true, title: String(result.title) };
}

/**
 * Chooses `folder` in the folder picker (IFileOpenDialog with
 * FOS_PICKFOLDERS), or cancels it when `folder` is null. Typing a folder's
 * path and pressing OK navigates into it rather than choosing it, so the
 * folder is confirmed with a second OK — only once the picker's address bar
 * shows that folder. Anything else cancels, so a test can't export into
 * the user's real folders by accident.
 */
export function answerFolderDialog(
  pid: number,
  folder: string | null,
  timeoutSeconds = 15,
): FileDialogResult {
  const folderName = folder === null ? "" : (folder.split(/[\\/]/).filter(Boolean).at(-1) ?? "");
  const result = parse(
    powershell(`${DIALOGS}
$deadline = (Get-Date).AddSeconds(${timeoutSeconds})
$dialog = [IntPtr]::Zero
while ($dialog -eq [IntPtr]::Zero -and (Get-Date) -lt $deadline) {
  $dialog = Find-FileDialog ${pid}
  if ($dialog -eq [IntPtr]::Zero) { Start-Sleep -Milliseconds 200 }
}
if ($dialog -eq [IntPtr]::Zero) { @{ found = $false; title = '' } | ConvertTo-Json -Compress; exit }
$title = [LayoutryDialogs]::Title($dialog)
$path = ${folder === null ? "$null" : psString(folder)}
if (-not $path) {
  [void][LayoutryDialogs]::PostMessage($dialog, 0x0111, [IntPtr]2, [IntPtr]::Zero)
  @{ found = $true; title = $title } | ConvertTo-Json -Compress; exit
}
$box = [LayoutryDialogs]::NameBox($dialog)
[LayoutryDialogs]::TypeText($box, $path)
$typed = [LayoutryDialogs]::GetText($box)
if ($typed -ne $path) {
  [void][LayoutryDialogs]::PostMessage($dialog, 0x0111, [IntPtr]2, [IntPtr]::Zero)
  throw "Folder box holds '$typed', not the requested path; cancelled the dialog"
}
[void][LayoutryDialogs]::PostMessage($dialog, 0x0111, [IntPtr]1, [IntPtr]::Zero)
$expected = 'Address: ' + ${psString(folderName)}
$deadline = (Get-Date).AddSeconds(${timeoutSeconds})
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 300
  if (-not ([LayoutryDialogs]::Dialogs(${pid}) -contains $dialog)) { break }
  $address = [LayoutryDialogs]::AddressText($dialog)
  # The breadcrumb names the folder, or shows its full path once navigated by typing.
  if ($address -eq $expected -or $address -eq ('Address: ' + $path)) {
    # An empty box makes OK choose the folder shown (a path still typed there would navigate again).
    [LayoutryDialogs]::TypeText($box, [string][char]8)
    [void][LayoutryDialogs]::PostMessage($dialog, 0x0111, [IntPtr]1, [IntPtr]::Zero)
    break
  }
}
if ([LayoutryDialogs]::Dialogs(${pid}) -contains $dialog) {
  Start-Sleep -Milliseconds 500
  if ([LayoutryDialogs]::Dialogs(${pid}) -contains $dialog) {
    [void][LayoutryDialogs]::PostMessage($dialog, 0x0111, [IntPtr]2, [IntPtr]::Zero)
    throw "The folder picker didn't choose '$path' (address: '$([LayoutryDialogs]::AddressText($dialog))'); cancelled it"
  }
}
@{ found = $true; title = $title } | ConvertTo-Json -Compress`),
  );
  return { found: result.found === true, title: String(result.title) };
}

/**
 * Answers Windows' own "file already exists — replace it?" confirmation
 * shown by the Save dialog: TDM_CLICK_BUTTON with IDYES (6) or IDNO (7).
 * Returns the confirmation's text, read through UI Automation.
 */
export function answerReplaceConfirmation(
  pid: number,
  replace: boolean,
  timeoutSeconds = 10,
): { found: boolean; text: string } {
  const result = parse(
    powershell(`${DIALOGS}
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
$ae = [System.Windows.Automation.AutomationElement]
$deadline = (Get-Date).AddSeconds(${timeoutSeconds})
$confirm = [IntPtr]::Zero
while ($confirm -eq [IntPtr]::Zero -and (Get-Date) -lt $deadline) {
  foreach ($h in [LayoutryDialogs]::Dialogs(${pid})) {
    if ([LayoutryDialogs]::NameBox($h) -eq [IntPtr]::Zero) { $confirm = $h; break }
  }
  if ($confirm -eq [IntPtr]::Zero) { Start-Sleep -Milliseconds 200 }
}
if ($confirm -eq [IntPtr]::Zero) { @{ found = $false; text = '' } | ConvertTo-Json -Compress; exit }
$textType = New-Object System.Windows.Automation.PropertyCondition($ae::ControlTypeProperty, [System.Windows.Automation.ControlType]::Text)
$texts = $ae::FromHandle($confirm).FindAll([System.Windows.Automation.TreeScope]::Descendants, $textType) | ForEach-Object { $_.Current.Name }
[void][LayoutryDialogs]::PostMessage($confirm, 0x0466, [IntPtr]${replace ? 6 : 7}, [IntPtr]::Zero)
@{ found = $true; text = ($texts -join ' | ') } | ConvertTo-Json -Compress`),
  );
  return { found: result.found === true, text: String(result.text) };
}
