$ErrorActionPreference = 'Stop'

$ProjectRoot = $PSScriptRoot
$ServerScript = Join-Path $ProjectRoot 'server\index.mjs'
$ReleaseFile = Join-Path $ProjectRoot 'release.json'
$ExpectedVersion = $null
$Port = 43118
$AppBaseUrl = "http://127.0.0.1:$Port/"
$PreviewLog = Join-Path $env:TEMP 'ai-study-v3-service.log'
$PreviewErrorLog = Join-Path $env:TEMP 'ai-study-v3-service-error.log'
$AppBrowserProfile = Join-Path $env:LOCALAPPDATA 'AIStudyPlan\EdgeProfileV2'
$MinimumChromiumMajor = 125

function Show-LaunchError {
  param([Parameter(Mandatory = $true)][string]$Message)

  try {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show(
      $Message,
      "AI Study Plan $ExpectedVersion - launch failed",
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
      $processInfo.CommandLine.IndexOf('server', [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -and
      $processInfo.CommandLine.IndexOf('index.mjs', [System.StringComparison]::OrdinalIgnoreCase) -ge 0
  }
  catch {
    return $false
  }
}

function Test-AppReady {
  try {
    $response = Invoke-WebRequest -Uri "${AppBaseUrl}api/health" -UseBasicParsing -TimeoutSec 2 -Headers @{
      'Cache-Control' = 'no-cache'
    }
    $health = $response.Content | ConvertFrom-Json
    return $response.StatusCode -eq 200 -and $health.ok -eq $true -and $health.appVersion -eq $ExpectedVersion -and $health.compatible -eq $true
  }
  catch {
    return $false
  }
}

function Test-IsAiStudyService {
  try {
    $info = Invoke-RestMethod -Uri "${AppBaseUrl}api/version" -TimeoutSec 2 -Headers @{
      'Cache-Control' = 'no-cache'
    }
    if ($info.service -eq 'ai-study-plan') {
      return $true
    }
    # Compatibility with releases made before the service marker existed.
    return -not [string]::IsNullOrWhiteSpace([string]$info.appVersion) -and
      -not [string]::IsNullOrWhiteSpace([string]$info.buildVersion) -and
      $null -ne $info.apiVersion -and $null -ne $info.dataSchemaVersion
  }
  catch {
    return $false
  }
}

function Get-CompatibleBrowser {
  $browserCandidates = @()
  if (${env:ProgramFiles(x86)}) {
    $browserCandidates += Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'
    $browserCandidates += Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'
  }
  if ($env:ProgramFiles) {
    $browserCandidates += Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'
    $browserCandidates += Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'
  }
  if ($env:LOCALAPPDATA) {
    $browserCandidates += Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\Application\msedge.exe'
    $browserCandidates += Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe'
  }
  foreach ($commandName in @('msedge.exe', 'chrome.exe')) {
    $browserCommand = Get-Command $commandName -ErrorAction SilentlyContinue
    if ($null -ne $browserCommand) {
      $browserCandidates += $browserCommand.Source
    }
  }

  return $browserCandidates |
    Where-Object { Test-Path -LiteralPath $_ } |
    Select-Object -Unique |
    ForEach-Object {
      $version = (Get-Item -LiteralPath $_).VersionInfo.ProductVersion
      $major = if ($version -match '^(\d+)') { [int]$Matches[1] } else { 0 }
      [PSCustomObject]@{ Path = $_; Version = $version; Major = $major }
    } |
    Where-Object { $_.Major -ge $MinimumChromiumMajor } |
    Sort-Object -Property Major -Descending |
    Select-Object -First 1
}

function Stop-StudyBrowserProcesses {
  $normalizedProfile = [System.IO.Path]::GetFullPath($AppBrowserProfile).TrimEnd('\')
  Get-CimInstance Win32_Process -Filter "Name = 'msedge.exe' OR Name = 'chrome.exe'" -ErrorAction SilentlyContinue |
    Where-Object {
      -not [string]::IsNullOrWhiteSpace($_.CommandLine) -and
      $_.CommandLine.IndexOf("--user-data-dir=$normalizedProfile", [System.StringComparison]::OrdinalIgnoreCase) -ge 0
    } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

function Open-StudyApp {
  $builtApp = Join-Path $ProjectRoot 'dist\index.html'
  $buildVersion = (Get-Item -LiteralPath $builtApp).LastWriteTimeUtc.Ticks
  $launchUrl = "$AppBaseUrl`?build=$buildVersion"
  $browser = Get-CompatibleBrowser

  if ($browser) {
    New-Item -ItemType Directory -Path $AppBrowserProfile -Force | Out-Null
    Stop-StudyBrowserProcesses
    Start-Process -FilePath $browser.Path -ArgumentList @(
      "--user-data-dir=$AppBrowserProfile",
      '--no-first-run',
      '--disable-default-apps',
      "--app=$launchUrl"
    )
    return
  }

  throw "A Chromium $MinimumChromiumMajor or newer browser is required for persistent highlights. Install or update Google Chrome or Microsoft Edge."
}

try {
  if (-not (Test-Path -LiteralPath $ReleaseFile)) {
    throw 'release.json was not found. The application release is incomplete.'
  }
  $release = Get-Content -LiteralPath $ReleaseFile -Encoding utf8 -Raw | ConvertFrom-Json
  $ExpectedVersion = [string]$release.version
  if ([string]::IsNullOrWhiteSpace($ExpectedVersion)) {
    throw 'release.json does not contain a valid version.'
  }
  $npmCommand = Get-Command 'npm.cmd' -ErrorAction SilentlyContinue
  if ($null -eq $npmCommand) {
    throw 'npm.cmd was not found. Install Node.js and try again.'
  }
  $nodeCommand = Get-Command 'node.exe' -ErrorAction SilentlyContinue
  if ($null -eq $nodeCommand) {
    throw 'node.exe was not found. Install Node.js 24 and try again.'
  }

  $build = Start-Process -FilePath $npmCommand.Source -ArgumentList @('run', 'build') `
    -WorkingDirectory $ProjectRoot -WindowStyle Hidden -Wait -PassThru
  $builtApp = Join-Path $ProjectRoot 'dist\index.html'
  if ($build.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $builtApp)) {
    throw 'The latest app build failed. Run npm run build in the project folder for details.'
  }
  $builtReleaseFile = Join-Path $ProjectRoot 'dist\release-meta.json'
  if (-not (Test-Path -LiteralPath $builtReleaseFile)) {
    throw 'The production build has no release metadata.'
  }
  $builtRelease = Get-Content -LiteralPath $builtReleaseFile -Encoding utf8 -Raw | ConvertFrom-Json
  if ($builtRelease.version -ne $ExpectedVersion) {
    throw "Frontend version $($builtRelease.version) does not match release $ExpectedVersion."
  }
  $builtHtml = Get-Content -LiteralPath $builtApp -Encoding utf8 -Raw
  if ($builtHtml.IndexOf('data-ai-study-css=', [System.StringComparison]::Ordinal) -lt 0) {
    throw 'The production page does not contain bundled styles, so it was not opened.'
  }

  $listenerProcessId = Get-ListenerProcessId
  if ($null -ne $listenerProcessId) {
    # The server may have been started with a relative script path, so its
    # command line does not always contain ProjectRoot. A healthy, compatible
    # version endpoint is the stronger ownership signal for this loopback port.
    if (Test-AppReady) {
      Open-StudyApp
      exit 0
    }
    if ((Test-IsAiStudyService) -or (Test-IsProjectPreview -ProcessId $listenerProcessId)) {
      Stop-Process -Id $listenerProcessId -Force
      for ($attempt = 0; $attempt -lt 20; $attempt += 1) {
        if ($null -eq (Get-ListenerProcessId)) { break }
        Start-Sleep -Milliseconds 150
      }
      if ($null -ne (Get-ListenerProcessId)) {
        throw "The previous AI Study Plan service could not be restarted."
      }
    }
    else {
      throw "Port $Port is already used by another program. Close that program and try again."
    }
  }

  Remove-Item -LiteralPath $PreviewLog, $PreviewErrorLog -Force -ErrorAction SilentlyContinue
  $preview = Start-Process -FilePath $nodeCommand.Source `
    -ArgumentList @($ServerScript) `
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
    throw "The V2 local server did not start within 12 seconds. $detail"
  }

  Open-StudyApp
}
catch {
  Show-LaunchError -Message $_.Exception.Message
  exit 1
}
