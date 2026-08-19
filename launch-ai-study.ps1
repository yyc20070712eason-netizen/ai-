$ErrorActionPreference = 'Stop'

$ProjectRoot = $PSScriptRoot
$Port = 43117
$AppBaseUrl = "http://127.0.0.1:$Port/"
$PreviewLog = Join-Path $env:TEMP 'ai-study-preview.log'
$PreviewErrorLog = Join-Path $env:TEMP 'ai-study-preview-error.log'

function Show-LaunchError {
  param([Parameter(Mandatory = $true)][string]$Message)

  try {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show(
      $Message,
      'AI Study Plan - launch failed',
      [System.Windows.MessageBoxButton]::OK,
      [System.Windows.MessageBoxImage]::Error
    ) | Out-Null
  }
  catch {
    Write-Error $Message
  }
}

function Get-ListenerProcessId {
  try {
    $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop |
      Select-Object -First 1
    if ($null -ne $connection) {
      return [int]$connection.OwningProcess
    }
  }
  catch {
    return $null
  }
  return $null
}

function Test-IsProjectPreview {
  param([Parameter(Mandatory = $true)][int]$ProcessId)

  try {
    $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId"
    if ($null -eq $processInfo -or [string]::IsNullOrWhiteSpace($processInfo.CommandLine)) {
      return $false
    }
    $normalizedRoot = [System.IO.Path]::GetFullPath($ProjectRoot).TrimEnd('\')
    return $processInfo.CommandLine.IndexOf($normalizedRoot, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -and
      $processInfo.CommandLine.IndexOf('vite', [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -and
      $processInfo.CommandLine.IndexOf('preview', [System.StringComparison]::OrdinalIgnoreCase) -ge 0
  }
  catch {
    return $false
  }
}

function Test-AppReady {
  try {
    $response = Invoke-WebRequest -Uri $AppBaseUrl -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200
  }
  catch {
    return $false
  }
}

function Open-StudyApp {
  $builtApp = Join-Path $ProjectRoot 'dist\index.html'
  $buildVersion = if (Test-Path -LiteralPath $builtApp) {
    (Get-Item -LiteralPath $builtApp).LastWriteTimeUtc.Ticks
  } else {
    [DateTime]::UtcNow.Ticks
  }
  $launchUrl = "$AppBaseUrl`?build=$buildVersion"

  $edgeCandidates = @()
  if (${env:ProgramFiles(x86)}) {
    $edgeCandidates += Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'
  }
  if ($env:ProgramFiles) {
    $edgeCandidates += Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'
  }
  $edgeCommand = Get-Command 'msedge.exe' -ErrorAction SilentlyContinue
  if ($null -ne $edgeCommand) {
    $edgeCandidates += $edgeCommand.Source
  }
  $edgePath = $edgeCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

  if ($edgePath) {
    Start-Process -FilePath $edgePath -ArgumentList "--app=$launchUrl"
    return
  }

  try {
    Start-Process $launchUrl
  }
  catch {
    throw "Microsoft Edge was not found and the default browser could not be opened. Open $launchUrl manually."
  }
}

try {
  $listenerProcessId = Get-ListenerProcessId
  if ($null -ne $listenerProcessId) {
    if (-not (Test-IsProjectPreview -ProcessId $listenerProcessId)) {
      throw "Port $Port is already used by another program. Close that program and try again; this launcher will not terminate it."
    }
    if (-not (Test-AppReady)) {
      throw "AI Study Plan owns port $Port but is not responding. Wait a moment and try again."
    }
    Open-StudyApp
    exit 0
  }

  $npmCommand = Get-Command 'npm.cmd' -ErrorAction SilentlyContinue
  if ($null -eq $npmCommand) {
    throw 'npm.cmd was not found. Install Node.js and try again.'
  }

  $builtApp = Join-Path $ProjectRoot 'dist\index.html'
  if (-not (Test-Path -LiteralPath $builtApp)) {
    $build = Start-Process -FilePath $npmCommand.Source -ArgumentList @('run', 'build') `
      -WorkingDirectory $ProjectRoot -WindowStyle Hidden -Wait -PassThru
    if ($build.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $builtApp)) {
      throw 'The app has not been built and the automatic build failed. Run npm run build in the project folder for details.'
    }
  }

  Remove-Item -LiteralPath $PreviewLog, $PreviewErrorLog -Force -ErrorAction SilentlyContinue
  $preview = Start-Process -FilePath $npmCommand.Source `
    -ArgumentList @('run', 'preview', '--', '--host', '127.0.0.1', '--port', "$Port", '--strictPort') `
    -WorkingDirectory $ProjectRoot -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput $PreviewLog -RedirectStandardError $PreviewErrorLog

  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
    if ($preview.HasExited) {
      break
    }
    if (Test-AppReady) {
      $ready = $true
      break
    }
    Start-Sleep -Milliseconds 400
  }

  if (-not $ready) {
    $detail = if (Test-Path -LiteralPath $PreviewErrorLog) {
      (Get-Content -LiteralPath $PreviewErrorLog -Raw -ErrorAction SilentlyContinue).Trim()
    } else {
      ''
    }
    if ([string]::IsNullOrWhiteSpace($detail)) {
      $detail = "Log file: $PreviewLog"
    }
    throw "The local server did not start within 12 seconds. $detail"
  }

  Open-StudyApp
}
catch {
  Show-LaunchError -Message $_.Exception.Message
  exit 1
}
