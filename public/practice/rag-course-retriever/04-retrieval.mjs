export function rrf(rankings, k = 60) {
  const scores = new Map()
  for (const ranking of rankings) ranking.forEach((id, index) => scores.set(id, (scores.get(id) ?? 0) + 1 / (k + index + 1)))
  return [...scores].sort((left, right) => right[1] - left[1]).map(([id]) => id)
}

export function keywordSearch(query, chunks) {
  return chunks.filter((chunk) => query.split(/\s+/u).some((term) => chunk.text.includes(term))).map((chunk) => chunk.id)
}
