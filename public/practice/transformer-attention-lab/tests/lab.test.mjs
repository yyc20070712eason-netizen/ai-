import test from 'node:test'
import assert from 'node:assert/strict'
import { neuron } from '../01-neuron-lab.mjs'
import { softmax, maskedScores } from '../04-attention.mjs'
import { decode } from '../05-decoder-simulation.mjs'

test('neuron and attention calculations are bounded', () => {
  assert.equal(neuron([1, 2], [0.5, -0.25], 0.5), 0.5)
  const weights = softmax(maskedScores([1, 2], [1, 0]))
  assert.deepEqual(weights, [1, 0])
})

test('decoder stops on eos', () => {
  const values = ['使', '<eos>']
  assert.equal(decode(['学习'], () => values.shift()).at(-1), '<eos>')
})
