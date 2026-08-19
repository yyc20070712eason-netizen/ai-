import test from 'node:test'
import assert from 'node:assert/strict'
import { runTask } from '../04-minimal-harness/index.mjs'

test('requires approval', () => assert.equal(runTask({ approved: false }).status, 'human-required'))
test('resume does not repeat a side effect', () => {
  const first = runTask({ approved: true })
  assert.equal(first.sideEffectCount, 1)
  assert.equal(runTask({ approved: true }, first.checkpoint).sideEffectCount, 0)
})
