import test from 'node:test'
import assert from 'node:assert/strict'
import { studyPrompt } from '../02-prompt-package.mjs'
import { savePlan } from '../03-tools.mjs'
import { runAssistant } from '../04-assistant-core.mjs'

test('prompt keeps system then human order', async () => assert.deepEqual((await studyPrompt.formatMessages({ topic: 'RAG' })).map((message) => message.getType()), ['system', 'human']))
test('write tool requires confirmation', async () => await assert.rejects(savePlan.invoke({ items: ['复习'], confirmed: false }), /confirmation-required/u))
test('mock model needs no API key and isolates session key', async () => assert.deepEqual((await runAssistant('安排复习', 's1')).memoryKeys, ['session:s1']))
