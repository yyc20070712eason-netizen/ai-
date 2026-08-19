export function decode(tokens, nextToken, maxTokens = 4) {
  const output = [...tokens]
  for (let index = 0; index < maxTokens; index += 1) {
    const token = nextToken(output)
    output.push(token)
    if (token === '<eos>') break
  }
  return output
}
