export function normalizeExtractedPdfText(value: string) {
  const withoutControls = [...value.normalize('NFKC')].filter((character) => {
    const code = character.codePointAt(0) ?? 0
    return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127)
  }).join('')
  return withoutControls
    .replace(/\r\n?/g, '\n')
    .replace(/([\p{Script=Han}])[ \t]+(?=[\p{Script=Han}\p{P}])/gu, '$1')
    .replace(/([\p{P}])[ \t]+(?=\p{Script=Han})/gu, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
