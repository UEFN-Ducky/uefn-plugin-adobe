$ErrorActionPreference = 'Continue'
$meta = Get-Content -LiteralPath '__META__' -Raw -Encoding UTF8 | ConvertFrom-Json
function Get-DocCount($a) {
  try { return [int]$a.Documents.Count } catch { return -1 }
}
function Coerce-App($obj) {
  if (-not $obj) { return $null }
  try { if ($obj.Application) { return $obj.Application } } catch {}
  try { if ($obj.Parent -and $obj.Parent.Documents) { return $obj.Parent } } catch {}
  return $obj
}
try {
  Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class DuckyAiNative {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lp);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr hWnd, EnumProc cb, IntPtr lp);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder sb, int max);
  [DllImport("oleacc.dll")]
  public static extern int AccessibleObjectFromWindow(IntPtr hwnd, uint id, ref Guid iid, [MarshalAs(UnmanagedType.IUnknown)] out object ppv);
  public const uint OBJID_NATIVEOM = 0xFFFFFFF0;
}
"@
} catch {}
function Try-NativeOM($hwnd) {
  if (-not ("DuckyAiNative" -as [type])) { return $null }
  $iid = [guid]"00020400-0000-0000-C000-000000000046"
  $obj = $null
  $hr = [DuckyAiNative]::AccessibleObjectFromWindow([IntPtr]$hwnd, [DuckyAiNative]::OBJID_NATIVEOM, [ref]$iid, [ref]$obj)
  if ($hr -ne 0 -or -not $obj) { return $null }
  return Coerce-App $obj
}
function Bind-FromWindows {
  if (-not ("DuckyAiNative" -as [type])) { return $null }
  $want = @{}
  foreach ($p in @($meta.pids)) { $want[[int]$p] = $true }
  $script:duckyAiBest = $null
  $cb = [DuckyAiNative+EnumProc] {
    param($hwnd, $lp)
    $pid = [uint32]0
    [void][DuckyAiNative]::GetWindowThreadProcessId($hwnd, [ref]$pid)
    if ($want.Count -gt 0 -and -not $want.ContainsKey([int]$pid)) { return $true }
    $cand = Try-NativeOM $hwnd
    if ($cand -and (Get-DocCount $cand) -gt 0) { $script:duckyAiBest = $cand; return $false }
    [void][DuckyAiNative]::EnumChildWindows($hwnd, [DuckyAiNative+EnumProc] {
      param($ch, $lp2)
      $c2 = Try-NativeOM $ch
      if ($c2 -and (Get-DocCount $c2) -gt 0) { $script:duckyAiBest = $c2; return $false }
      return $true
    }, [IntPtr]::Zero)
    return $true
  }
  [void][DuckyAiNative]::EnumWindows($cb, [IntPtr]::Zero)
  return $script:duckyAiBest
}
function Bind-Illustrator {
  $native = Bind-FromWindows
  if ($native -and (Get-DocCount $native) -gt 0) { return $native }
  $app = $null
  try { $app = [Runtime.InteropServices.Marshal]::GetActiveObject('__PROGID__') } catch {}
  if ($app -and (Get-DocCount $app) -gt 0) { return $app }
  foreach ($b in @($meta.binds)) {
    $s = [string]$b
    if (-not $s) { continue }
    $obj = $null
    try { $obj = [Runtime.InteropServices.Marshal]::BindToMoniker($s) } catch {}
    $cand = Coerce-App $obj
    if ($cand -and (Get-DocCount $cand) -gt 0) { return $cand }
  }
  if ($app) { return $app }
  return New-Object -ComObject '__PROGID__' -ErrorAction Stop
}
try {
  $wsh = New-Object -ComObject 'WScript.Shell'
  foreach ($t in @($meta.titles)) {
    try { $wsh.AppActivate([string]$t) | Out-Null } catch {}
  }
  foreach ($b in @($meta.binds)) {
    try { $wsh.AppActivate([string]$b) | Out-Null } catch {}
  }
  if (__ACTIVATE__ -eq 1) {
    try { $wsh.AppActivate('__APP_NAME__') | Out-Null } catch {}
  }
  $app = Bind-Illustrator
  $app.DoJavaScript("$.evalFile(new File('__JSX__'))")
} catch {
  Write-Error "COM automation failed: $_"
  exit 1
}
