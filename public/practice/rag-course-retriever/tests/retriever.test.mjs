import test from 'node:test'
import assert from 'node:assert/strict'
import chunks from '../02-chunks.json' with { type: 'json' }
import { keywordSearch, rrf } from '../04-retrieval.mjs'
import { groundedAnswer } from '../05-rag-answer.mjs'

test('retrieval deduplicates fused results', () => assert.deepEqual(rrf([['c1', 'c2'], ['c1']]), ['c1', 'c2']))
test('answer cites only retrieved chunks', () => assert.deepEqual(groundedAnswer('什么是注意力', keywordSearch('注意力', chunks), chunks).citations, ['c1']))
test('no evidence refuses', () => assert.equal(groundedAnswer('未知', [], chunks).refused, true))
