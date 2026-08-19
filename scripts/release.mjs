import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseReleaseHistory } from '../shared/release-history.mjs'

const root = resolve(import.meta.dirname, '..')
const releasePath = resolve(root, 'release.json')
const packagePath = resolve(root, 'package.json')
const packageLockPath = resolve(root, 'package-lock.json')
const changelogPath = resolve(root, 'CHANGELOG.md')
const semver = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

async function check() {
  const [release, packageJson, packageLock, changelog] = await Promise.all([
    readJson(releasePath),
    readJson(packagePath),
    readJson(packageLockPath),
    readFile(changelogPath, 'utf8'),
  ])
  const failures = []
  if (release.schemaVersion !== 1) failures.push('release.json schemaVersion 必须为 1')
  if (!semver.test(release.version)) failures.push('版本号必须符合 semver')
  if (packageJson.version !== release.version) failures.push('package.json 与 release.json 版本不一致')
  if (packageLock.version !== release.version || packageLock.packages?.['']?.version !== release.version) failures.push('package-lock.json 与 release.json 版本不一致')
  if (!['stable', 'beta', 'alpha'].includes(release.channel)) failures.push('发布通道无效')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(release.releasedAt)) failures.push('发布日期必须为 YYYY-MM-DD')
  if (!Number.isInteger(release.apiVersion) || release.apiVersion < 1) failures.push('apiVersion 无效')
  if (!Number.isInteger(release.dataSchemaVersion) || release.dataSchemaVersion < 1) failures.push('dataSchemaVersion 无效')
  if (!Array.isArray(release.highlights) || !release.highlights.length || release.highlights.some((item) => typeof item !== 'string' || !item.trim())) failures.push('版本亮点不能为空')
  if (!changelog.includes(`## ${release.version} — ${release.releasedAt}`)) failures.push('CHANGELOG 缺少当前版本记录')
  const history = parseReleaseHistory(changelog)
  if (!history.length || history[0].version !== release.version || history[0].releasedAt !== release.releasedAt) failures.push('历代版本记录必须以当前版本开头')
  if (new Set(history.map((entry) => entry.version)).size !== history.length) failures.push('历代版本记录存在重复版本号')
  if (failures.length) throw new Error(`发布检查失败：\n- ${failures.join('\n- ')}`)
  console.log(`Release ${release.version} (${release.channel}) is consistent.`)
}

async function prepare(version, note) {
  if (!semver.test(version || '')) throw new Error('用法：npm run release:prepare -- 3.0.1 "更新摘要"')
  if (!note?.trim()) throw new Error('更新摘要不能为空。')
  const [release, packageJson, packageLock, changelog] = await Promise.all([
    readJson(releasePath),
    readJson(packagePath),
    readJson(packageLockPath),
    readFile(changelogPath, 'utf8'),
  ])
  const releasedAt = new Date().toISOString().slice(0, 10)
  release.version = version
  release.releasedAt = releasedAt
  release.highlights = [note.trim()]
  packageJson.version = version
  packageLock.version = version
  if (packageLock.packages?.['']) packageLock.packages[''].version = version
  const heading = `## ${version} — ${releasedAt}\n\n- ${note.trim()}\n\n`
  const nextChangelog = changelog.replace(/^# 更新记录\s*/u, `# 更新记录\n\n${heading}`)
  await Promise.all([
    writeFile(releasePath, `${JSON.stringify(release, null, 2)}\n`, 'utf8'),
    writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8'),
    writeFile(packageLockPath, `${JSON.stringify(packageLock, null, 2)}\n`, 'utf8'),
    writeFile(changelogPath, nextChangelog, 'utf8'),
  ])
  console.log(`Prepared release ${version}. Run npm run release:package next.`)
}

const [command = 'check', version, ...noteParts] = process.argv.slice(2)
if (command === 'check') await check()
else if (command === 'prepare') await prepare(version, noteParts.join(' '))
else throw new Error(`未知发布命令：${command}`)
