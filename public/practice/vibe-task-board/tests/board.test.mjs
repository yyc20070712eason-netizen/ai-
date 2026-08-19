import test from 'node:test'
import assert from 'node:assert/strict'
import { addTask, completeTask } from '../src/board.mjs'

test('adds and completes a virtual task', () => {
  const added = addTask([], '复习注意力')
  assert.equal(added[0].status, 'open')
  assert.equal(completeTask(added, added[0].id)[0].status, 'done')
})

test('rejects an empty title', () => assert.throws(() => addTask([], ' '), /title-required/u))
