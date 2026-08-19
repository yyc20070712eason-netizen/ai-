import { ChatPromptTemplate } from '@langchain/core/prompts'

export const studyPrompt = ChatPromptTemplate.fromMessages([
  ['system', '你是本地学习助手，只使用给定主题。'],
  ['human', '为 {topic} 生成三个复习问题。'],
])
