export function toolTrace(threadId, toolCallId, result) {
  return { threadId, messages: ['human', 'ai-tool', 'tool', 'ai'], toolCallId, toolResult: result, stopReason: result instanceof Error ? 'tool-error' : 'completed' }
}
