import type { SourceReference, WorkspaceDocument } from '../types'

export type SourcePage = { page: number; text: string }
export type SourceTarget = { page: number; quote: string }

function normalizedSection(value: string) {
  return value.normalize('NFKC').replace(/[．。]/g, '.')
}

function searchableText(value: string) {
  return normalizedSection(value).toLowerCase().replace(/[^\p{L}\p{N}.]+/gu, '')
}

function looseText(value: string) {
  return searchableText(value).replaceAll('.', '')
}

function sectionNumbers(value: string) {
  return [...normalizedSection(value).matchAll(/\d+(?:\.\d+)+/g)].map((match) => match[0])
}

function labelPhrases(value: string) {
  const withoutPrefix = value.replace(/^\s*(?:原文|补充)\s*[:：]?\s*/u, '')
  const withoutSections = normalizedSection(withoutPrefix)
    .replace(/\d+(?:\.\d+)+(?:\s*[-–—至]\s*\d+(?:\.\d+)+)?/g, ' ')
  return withoutSections
    .split(/[、,，;；/|]/u)
    .map((item) => looseText(item))
    .filter((item) => item.length >= 4)
}

export function locateSourceTarget(
  pages: SourcePage[],
  references: SourceReference[],
  stageTitle = '',
) {
  if (!pages.length || (!references.length && !stageTitle.trim())) return null

  const title = looseText(stageTitle)
  const labels = references.map((reference) => ({
    exact: looseText(reference.label.replace(/^\s*(?:原文|补充)\s*[:：]?\s*/u, '')),
    hasDescriptiveText: /[\p{L}]/u.test(reference.label.replace(/(?:原文|补充)|\d+(?:[.．。]\d+)+/gu, '')),
    phrases: labelPhrases(reference.label),
    sections: sectionNumbers(reference.label),
  }))

  let best: { page: number; quote: string; score: number } | null = null
  for (const page of pages) {
    const searchable = searchableText(page.text)
    const loose = searchable.replaceAll('.', '')
    const headingDensity = sectionNumbers(page.text).length
    let score = 0
    let quote = ''

    for (const label of labels) {
      if (label.hasDescriptiveText && label.exact.length >= 4 && loose.includes(label.exact) && score < 120) {
        score = 120
        quote = label.exact
      }
      for (const phrase of label.phrases) {
        if (loose.includes(phrase) && score < 90) {
          score = 90
          quote = phrase
        }
      }
      label.sections.forEach((section, index) => {
        const sectionScore = 55 - Math.min(index, 5) * 2
        if (searchable.includes(section) && score < sectionScore) {
          score = sectionScore
          quote = section
        }
      })
    }

    if (title.length >= 4 && loose.includes(title) && score < 75) {
      score = 75
      quote = title
    }
    if (score > 0 && headingDensity > 8) score -= Math.min(30, (headingDensity - 8) * 3)

    if (score >= 35 && (!best || score > best.score || (score === best.score && page.page < best.page))) {
      best = { page: page.page, quote, score }
    }
  }

  return best ? { page: best.page, quote: best.quote } : null
}

export function locateSourcePage(pages: SourcePage[], references: SourceReference[], stageTitle = '') {
  return locateSourceTarget(pages, references, stageTitle)?.page ?? null
}

export function selectSourceDocument(documents: WorkspaceDocument[], references: SourceReference[]) {
  const sourceIds = new Set(references.map((reference) => reference.sourceId))
  const matching = documents.filter((document) => sourceIds.has(document.sourceId))
  return matching.find((document) => document.isLatest)
    ?? matching[0]
    ?? documents.find((document) => document.isLatest)
    ?? documents[0]
    ?? null
}
