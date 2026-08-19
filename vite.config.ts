import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { readFileSync } from 'node:fs'
import { parseReleaseHistory } from './shared/release-history.mjs'

const release = JSON.parse(readFileSync(new URL('./release.json', import.meta.url), 'utf8')) as {
  version: string
  channel: string
  releasedAt: string
  apiVersion: number
  dataSchemaVersion: number
  highlights: string[]
}
const builtAt = new Date().toISOString()
const buildId = process.env.AI_STUDY_BUILD_ID ?? `${release.version}+${builtAt.replace(/[-:.TZ]/g, '').slice(0, 14)}`
const releaseHistory = parseReleaseHistory(readFileSync(new URL('./CHANGELOG.md', import.meta.url), 'utf8'))
const releaseMeta = { ...release, history: releaseHistory, buildId, builtAt }

const emitReleaseMetadata = (): Plugin => ({
  name: 'emit-ai-study-release-metadata',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'release-meta.json', source: `${JSON.stringify(releaseMeta, null, 2)}\n` })
  },
})

const inlineBuiltStyles = (): Plugin => ({
  name: 'inline-ai-study-styles',
  apply: 'build',
  enforce: 'post',
  generateBundle(_options, bundle) {
    const htmlAsset = bundle['index.html']
    if (!htmlAsset || htmlAsset.type !== 'asset') {
      throw new Error('The production index.html asset was not generated.')
    }

    let inlinedStyleCount = 0
    const html = String(htmlAsset.source).replace(
      /<link\b[^>]*\brel=["']stylesheet["'][^>]*>/g,
      (tag) => {
        const href = tag.match(/\bhref=["']([^"']+\.css)["']/)?.[1]
        const assetName = href?.replace(/^\//, '')
        const cssAsset = assetName ? bundle[assetName] : undefined
        if (!cssAsset || cssAsset.type !== 'asset') {
          throw new Error(`Unable to inline the stylesheet referenced by ${tag}.`)
        }

        inlinedStyleCount += 1
        const css = String(cssAsset.source).replace(/<\/style/gi, '<\\/style')
        return `<style data-ai-study-css="${assetName}">${css}</style>`
      },
    )

    if (inlinedStyleCount === 0) {
      throw new Error('The production build contains no stylesheet to inline.')
    }

    htmlAsset.source = html
  },
})

export default defineConfig({
  plugins: [react(), emitReleaseMetadata(), inlineBuiltStyles()],
  define: {
    __APP_RELEASE__: JSON.stringify(releaseMeta),
  },
  build: {
    target: 'chrome100',
    cssTarget: 'chrome100',
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    exclude: [...configDefaults.exclude, 'public/practice/**', 'dist/practice/**'],
  },
})
