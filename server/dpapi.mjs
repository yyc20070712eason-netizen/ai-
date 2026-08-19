import { spawnSync } from 'node:child_process'

const POWERSHELL_PREFIX = "$ErrorActionPreference='Stop';Add-Type -AssemblyName System.Security;"

function runDpapi(script, input, errorMessage) {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `${POWERSHELL_PREFIX}${script}`], {
    input,
    encoding: 'utf8',
    windowsHide: true,
  })
  if (result.status !== 0 || !result.stdout.trim()) throw new Error(errorMessage)
  return result.stdout.trim()
}

export function protectSecret(secret) {
  return runDpapi(
    "$v=[Console]::In.ReadToEnd();$b=[Text.Encoding]::UTF8.GetBytes($v);$p=[Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Convert]::ToBase64String($p)",
    secret,
    'Windows 无法安全保存 API Key。',
  )
}

export function unprotectSecret(payload) {
  return runDpapi(
    "$v=[Console]::In.ReadToEnd();$b=[Convert]::FromBase64String($v);$p=[Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Text.Encoding]::UTF8.GetString($p)",
    payload,
    'Windows 无法读取已保存的 API Key。',
  )
}

export function protectAndVerifySecret(secret) {
  const protectedValue = protectSecret(secret)
  if (unprotectSecret(protectedValue) !== secret) throw new Error('Windows 未能验证加密后的 API Key。')
  return protectedValue
}
