import { tool } from '@langchain/core/tools'
import { z } from 'zod'

export const readPlan = tool(async ({ date }) => `plan:${date}`, { name: 'read_plan', description: '读取虚拟学习计划', schema: z.object({ date: z.string() }) })
export const savePlan = tool(async ({ items, confirmed }) => {
  if (!confirmed) throw new Error('confirmation-required')
  return { saved: items.length }
}, { name: 'save_plan', description: '保存虚拟学习计划', schema: z.object({ items: z.array(z.string()), confirmed: z.boolean() }) })
