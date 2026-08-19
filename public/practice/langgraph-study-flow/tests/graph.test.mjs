import test from 'node:test'
import assert from 'node:assert/strict'
import { smokeGraph } from '../01-graph-smoke.mjs'
import { stateGraph } from '../02-state-graph.mjs'
import { appendUnique, routeByBudget } from '../03-control-flow.mjs'
import { resume } from '../05-reliable-study-graph/resume.mjs'

test('smoke and state graphs compile and invoke', async () => {
  assert.equal((await smokeGraph.invoke({})).message, 'hello')
  assert.equal((await stateGraph.invoke({ topic: ' RAG ' })).status, 'ready')
})
test('reducers and budgets terminate deterministically', () => {
  assert.deepEqual(appendUnique(['a'], ['a', 'b']), ['a', 'b'])
  assert.equal(routeByBudget({ confidence: 1, iteration: 3, maxIterations: 3 }), 'fallback')
})
test('resume does not duplicate side effects', () => {
  const first = resume({ threadId: 't1', applied: false }, 'approve', [])
  assert.equal(first.effects.length, 1)
  assert.equal(resume(first.checkpoint, 'approve', first.effects).effects.length, 1)
})
