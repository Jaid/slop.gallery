import {expect, test} from 'bun:test'

import {readFastStreamBudget, readStreamBudget} from '../../src/lib/rendering/streamBudget.ts'

test('?stream_budget takes milliseconds or false, 8 by default', () => {
  expect(readStreamBudget('')).toBe(8)
  expect(readStreamBudget('?stream_budget=15')).toBe(15)
  expect(readStreamBudget('?stream_budget=2.5')).toBe(2.5)
  expect(readStreamBudget('?stream_budget=0')).toBe(0)
  expect(readStreamBudget('?stream_budget=false')).toBe(false)
  expect(readStreamBudget('?stream_budget=-1')).toBe(8)
  expect(readStreamBudget('?stream_budget=unlimited')).toBe(8)
  expect(readStreamBudget('?stream_budget')).toBe(8)
})
test('?test=true streams without a limit unless ?stream_budget says otherwise', () => {
  expect(readStreamBudget('?test=true')).toBe(false)
  expect(readStreamBudget('?test=true&stream_budget=4')).toBe(4)
  expect(readStreamBudget('?test=false')).toBe(8)
})
test('?fast_stream_budget takes milliseconds or false, 50 by default', () => {
  expect(readFastStreamBudget('')).toBe(50)
  expect(readFastStreamBudget('?fast_stream_budget=12')).toBe(12)
  expect(readFastStreamBudget('?fast_stream_budget=false')).toBe(false)
  expect(readFastStreamBudget('?fast_stream_budget=-1')).toBe(50)
  expect(readFastStreamBudget('?fast_stream_budget=false&stream_budget=4')).toBe(false)
})
test('?fast_stream_budget defaults to the regular budget where that builds more', () => {
  expect(readFastStreamBudget('?stream_budget=4')).toBe(50)
  expect(readFastStreamBudget('?stream_budget=80')).toBe(80)
  expect(readFastStreamBudget('?stream_budget=false')).toBe(false)
  expect(readFastStreamBudget('?test=true')).toBe(false)
  expect(readFastStreamBudget('?test=true&stream_budget=4')).toBe(50)
  expect(readFastStreamBudget('?test=true&fast_stream_budget=10')).toBe(10)
})
