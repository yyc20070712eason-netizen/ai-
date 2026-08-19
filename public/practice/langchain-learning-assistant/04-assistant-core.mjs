import { FakeListChatModel } from '@langchain/core/utils/testing'

export const model = new FakeListChatModel({ responses: ['先复习注意力，再完成两道题。'] })

export async function runAssistant(input, sessionId) {
  const response = await model.invoke(input)
  return { sessionId, text: response.content, toolCalls: [], stopReason: 'completed', memoryKeys: [`session:${sessionId}`] }
}
