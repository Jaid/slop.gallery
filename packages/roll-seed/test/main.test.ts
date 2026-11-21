import {expect, spyOn, test} from 'bun:test'

import rollSeed from '../src/main.ts'

test('the lowest and highest random draws give the first and last seeds, including 65 536 but never zero', () => {
  let byte = 0
  using random = spyOn(crypto, 'getRandomValues').mockImplementation(<T extends ArrayBufferView>(array: T) => {
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength)
    bytes.fill(byte)
    return array
  })
  expect(rollSeed()).toBe(1)
  byte = 255
  expect(rollSeed()).toBe(65_536)
  expect(random).toHaveBeenCalledTimes(2)
})
test('integers wrap in the one-based range, even as decimal strings beyond safe integer precision', () => {
  for (const [input, seed] of [[1, 1], [65_536, 65_536], [65_537, 1], [0, 65_536], [-1, 65_535], ['+00042', 42], ['9007199254740993', 1], ['-9007199254740993', 65_535]] as const) {
    expect(rollSeed(input)).toBe(seed)
  }
})
test('text and byte views give repeatable seeds without drawing entropy', () => {
  using random = spyOn(crypto, 'getRandomValues')
  const bytes = Uint8Array.of(9, 1, 2, 3, 8)
  const seed = rollSeed(bytes.subarray(1, 4))
  expect(rollSeed(Uint8Array.of(1, 2, 3).buffer)).toBe(seed)
  for (const input of ['Hanover', '🎨', '', new Uint8Array(0), 2.5, Infinity, Number.NaN]) {
    const value = rollSeed(input)
    expect(value).toBeInteger()
    expect(value).toBeWithin(1, 65_537)
    expect(rollSeed(input)).toBe(value)
  }
  expect(rollSeed('Hanover')).not.toBe(rollSeed('Salon'))
  expect(random).not.toHaveBeenCalled()
})
