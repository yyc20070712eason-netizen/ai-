export function groundedAnswer(question, retrievedIds, chunks) {
  const evidence = chunks.filter((chunk) => retrievedIds.includes(chunk.id))
  if (evidence.length === 0) return { answer: '资料中没有足够证据。', citations: [], refused: true }
  return { answer: `${question}：${evidence[0].text}`, citations: [evidence[0].id], refused: false }
}
