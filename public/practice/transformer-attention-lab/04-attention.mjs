export function softmax(values) {
  const max = Math.max(...values)
  const exp = values.map((value) => Math.exp(value - max))
  const total = exp.reduce((sum, value) => sum + value, 0)
  return exp.map((value) => value / total)
}

export function maskedScores(scores, mask) {
  return scores.map((value, index) => mask[index] ? value : Number.NEGATIVE_INFINITY)
}
