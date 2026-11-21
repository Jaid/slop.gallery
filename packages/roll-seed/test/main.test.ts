import {expect, spyOn, test} from 'bun:test'

import toUint16 from '../src/lib/toUint16.ts'
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
test('integers keep their low 16 bits in two’s complement, as numbers and as decimal text of any length', () => {
  const integers = [0, -0, 1, -1, 65_535, 65_536, -65_536, 65_537, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, 2 ** 53 + 2, -(2 ** 60) - 2 ** 20, 1e20, -1e20, Number.MAX_VALUE, -Number.MAX_VALUE]
  for (const integer of integers) {
    expect(toUint16(integer)).toBe(Number(BigInt.asUintN(16, BigInt(integer))))
  }
  const texts = ['0', '-0', '+0', '00065536', '-65536', '9007199254740993', '-9007199254740993', '9'.repeat(400), `-${'7'.repeat(400)}`, '+123456789012345678901234567890']
  for (const text of texts) {
    expect(toUint16(text)).toBe(Number(BigInt.asUintN(16, BigInt(text))))
  }
  for (const input of [0.5, Infinity, Number.NaN, '', '-', '1.5', '1e3', ' 1', '0x10', '١٢']) {
    expect(() => toUint16(input)).toThrow(RangeError)
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
