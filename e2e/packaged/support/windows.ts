import { spawnSync } from "node:child_process";

/** Runs a Windows PowerShell script and returns its trimmed stdout. */
export function powershell(script: string): string {
  const result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      script,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`PowerShell failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

/** PowerShell single-quoted string literal. */
export function psString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Win32 helpers. Windows are located with EnumWindows by owning process —
 * not .NET's MainWindowHandle or a UI Automation tree walk, which proved
 * unreliable for Chromium windows and for the native task dialog.
 */
const WIN32 = `
if (-not ('LayoutryWin32' -as [type])) {
  Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class LayoutryWin32 {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback, IntPtr lParam);
  [DllImport("user32.dll")] static extern int GetClassName(IntPtr hWnd, StringBuilder name, int max);
  [DllImport("user32.dll")] static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int max);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr parent, EnumProc callback, IntPtr lParam);
  [DllImport("user32.dll")] static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam, uint flags, uint timeout, out IntPtr result);
  /** Text of every Win32 push button inside a dialog. */
  public static string[] Buttons(IntPtr dialog) {
    var names = new System.Collections.Generic.List<string>();
    EnumChildWindows(dialog, (h, l) => {
      var name = new StringBuilder(64); GetClassName(h, name, 64);
      if (name.ToString() == "Button") names.Add(Title(h));
      return true;
    }, IntPtr.Zero);
    return names.ToArray();
  }
  /**
   * Presses the dialog button with this exact text through the task
   * dialog's own TDM_CLICK_BUTTON message — independent of focus and of
   * which windows overlap it. (BM_CLICK and synthetic mouse input both
   * proved unreliable once focus moves, e.g. after a second launch.)
   * Electron gives its custom task-dialog buttons the command ID
   * 100 + button index; verified against Electron 44 (Cancel = 100,
   * Discard and Close = 101).
   */
  public static bool Click(IntPtr dialog, string label) {
    int index = Array.IndexOf(Buttons(dialog), label);
    if (index < 0) return false;
    IntPtr ignored;
    SendMessageTimeout(dialog, 0x0466, (IntPtr)(100 + index), IntPtr.Zero, 0x0002, 5000, out ignored);
    return true;
  }
  /** First visible top-level window of the process with the given class. */
  public static IntPtr Find(uint pid, string className) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((h, l) => {
      uint owner; GetWindowThreadProcessId(h, out owner);
      if (owner != pid || !IsWindowVisible(h)) return true;
      var name = new StringBuilder(256); GetClassName(h, name, 256);
      if (name.ToString() != className) return true;
      found = h; return false;
    }, IntPtr.Zero);
    return found;
  }
  public static string Title(IntPtr hWnd) {
    var text = new StringBuilder(512); GetWindowText(hWnd, text, 512); return text.ToString();
  }
}
"@
}
function Find-LayoutryMainWindow([uint32]$TargetPid) { [LayoutryWin32]::Find($TargetPid, 'Chrome_WidgetWin_1') }`;

export interface MainWindowState {
  found: boolean;
  title: string;
  minimized: boolean;
  visible: boolean;
  foreground: boolean;
}

/** OS-level state of the process's visible main window. */
export function mainWindowState(pid: number): MainWindowState {
  const json = powershell(`${WIN32}
$h = Find-LayoutryMainWindow ${pid}
@{ found = ($h -ne [IntPtr]::Zero); title = [LayoutryWin32]::Title($h); minimized = [LayoutryWin32]::IsIconic($h); visible = [LayoutryWin32]::IsWindowVisible($h); foreground = ([LayoutryWin32]::GetForegroundWindow() -eq $h) } | ConvertTo-Json -Compress`);
  const parsed: unknown = JSON.parse(json);
  if (typeof parsed !== "object" || parsed === null) throw new Error(json);
  return {
    found: Reflect.get(parsed, "found") === true,
    title: String(Reflect.get(parsed, "title")),
    minimized: Reflect.get(parsed, "minimized") === true,
    visible: Reflect.get(parsed, "visible") === true,
    foreground: Reflect.get(parsed, "foreground") === true,
  };
}

export function minimizeMainWindow(pid: number): void {
  // SW_MINIMIZE = 6
  powershell(`${WIN32}
[void][LayoutryWin32]::ShowWindow((Find-LayoutryMainWindow ${pid}), 6)`);
}

/**
 * Posts WM_SYSCOMMAND/SC_CLOSE to the main window — exactly what clicking
 * its title-bar X or pressing Alt+F4 sends.
 */
export function requestMainWindowClose(pid: number): void {
  powershell(`${WIN32}
$h = Find-LayoutryMainWindow ${pid}
if ($h -eq [IntPtr]::Zero) { throw 'Layoutry main window not found' }
[void][LayoutryWin32]::PostMessage($h, 0x0112, [IntPtr]0xF060, [IntPtr]::Zero)`);
}

export interface NativeDialog {
  found: boolean;
  text: string;
  buttons: string[];
}

/**
 * Waits for the process's native message box (a visible #32770 window),
 * reports its text (UI Automation) and buttons (Win32 child windows — UI
 * Automation exposes task-dialog buttons only as panes without an Invoke
 * pattern) and, optionally, presses one of them.
 */
export function nativeDialog(
  pid: number,
  clickButton?: string,
  timeoutSeconds = 10,
): NativeDialog {
  const json = powershell(`${WIN32}
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
$deadline = (Get-Date).AddSeconds(${timeoutSeconds})
$h = [IntPtr]::Zero
while ($h -eq [IntPtr]::Zero -and (Get-Date) -lt $deadline) {
  $h = [LayoutryWin32]::Find(${pid}, '#32770')
  if ($h -eq [IntPtr]::Zero) { Start-Sleep -Milliseconds 200 }
}
if ($h -eq [IntPtr]::Zero) { @{ found = $false; text = ''; buttons = @() } | ConvertTo-Json -Compress; exit }
$ae = [System.Windows.Automation.AutomationElement]
$scope = [System.Windows.Automation.TreeScope]
$dialog = $ae::FromHandle($h)
$textType = New-Object System.Windows.Automation.PropertyCondition($ae::ControlTypeProperty, [System.Windows.Automation.ControlType]::Text)
$texts = $dialog.FindAll($scope::Descendants, $textType) | ForEach-Object { $_.Current.Name }
$buttons = @([LayoutryWin32]::Buttons($h))
$click = ${clickButton === undefined ? "$null" : psString(clickButton)}
if ($click -and -not [LayoutryWin32]::Click($h, $click)) { throw "Dialog button not found: $click" }
@{ found = $true; text = ($texts -join ' | '); buttons = $buttons } | ConvertTo-Json -Compress`);
  const parsed: unknown = JSON.parse(json);
  if (typeof parsed !== "object" || parsed === null) throw new Error(json);
  const buttons: unknown = Reflect.get(parsed, "buttons");
  return {
    found: Reflect.get(parsed, "found") === true,
    text: String(Reflect.get(parsed, "text")),
    buttons: Array.isArray(buttons) ? buttons.map(String) : [],
  };
}

export interface ProcessInfo {
  pid: number;
  parentPid: number;
  name: string;
  path: string;
  workingSetBytes: number;
}

/** The process and all its descendants (Electron's GPU, renderer, utility processes). */
export function processTree(rootPid: number): ProcessInfo[] {
  const json = powershell(
    `Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, Name, ExecutablePath, WorkingSetSize | ConvertTo-Json -Compress`,
  );
  const parsed: unknown = JSON.parse(json);
  const all: ProcessInfo[] = (Array.isArray(parsed) ? parsed : []).map(
    (entry: unknown) => ({
      pid: Number(Reflect.get(Object(entry), "ProcessId")),
      parentPid: Number(Reflect.get(Object(entry), "ParentProcessId")),
      name: String(Reflect.get(Object(entry), "Name")),
      path: String(Reflect.get(Object(entry), "ExecutablePath") ?? ""),
      workingSetBytes: Number(Reflect.get(Object(entry), "WorkingSetSize")),
    }),
  );
  const tree = all.filter((process) => process.pid === rootPid);
  for (let index = 0; index < tree.length; index += 1) {
    tree.push(
      ...all.filter((process) => process.parentPid === tree[index].pid),
    );
  }
  return tree;
}

export interface VersionInfo {
  ProductName: string;
  FileDescription: string;
  FileVersion: string;
  CompanyName: string;
  LegalCopyright: string;
  Signature: string;
}

export function executableInfo(exePath: string): VersionInfo {
  const json = powershell(`
$v = (Get-Item -LiteralPath ${psString(exePath)}).VersionInfo
@{ ProductName = $v.ProductName; FileDescription = $v.FileDescription; FileVersion = $v.FileVersion; CompanyName = $v.CompanyName; LegalCopyright = [string]$v.LegalCopyright; Signature = [string](Get-AuthenticodeSignature -LiteralPath ${psString(exePath)}).Status } | ConvertTo-Json -Compress`);
  const parsed: unknown = JSON.parse(json);
  const field = (name: string) =>
    String(Reflect.get(Object(parsed), name) ?? "");
  return {
    ProductName: field("ProductName"),
    FileDescription: field("FileDescription"),
    FileVersion: field("FileVersion"),
    CompanyName: field("CompanyName"),
    LegalCopyright: field("LegalCopyright"),
    Signature: field("Signature"),
  };
}

/** SHA-256 of the 32x32 icon Windows shows for an executable. */
export function associatedIconHash(exePath: string): string {
  return powershell(`
Add-Type -AssemblyName System.Drawing
$icon = [System.Drawing.Icon]::ExtractAssociatedIcon(${psString(exePath)})
$stream = New-Object System.IO.MemoryStream
$icon.ToBitmap().Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
[BitConverter]::ToString([System.Security.Cryptography.SHA256]::Create().ComputeHash($stream.ToArray()))`);
}

export function expandZip(zipPath: string, destination: string): void {
  powershell(
    `Expand-Archive -LiteralPath ${psString(zipPath)} -DestinationPath ${psString(destination)} -Force`,
  );
}
