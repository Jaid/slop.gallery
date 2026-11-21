import {expect, spyOn, test} from 'bun:test'

import murmur3 from '../src/lib/murmur3.ts'
import toUint16 from '../src/lib/toUint16.ts'
import rollSeed, {maximumSeed} from '../src/main.ts'

const textEncoder = new TextEncoder
const encode = (text: string) => textEncoder.encode(text)
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
  expect(rollSeed('abc')).not.toBe(rollSeed(encode('abc')))
  expect(rollSeed(2.5)).toBe(rollSeed('2.5'))
  expect(random).not.toHaveBeenCalled()
})
test('the hash agrees with the reference MurmurHash3 x86 32-bit', () => {
  for (const [bytes, seed, hash] of [
    [encode(''), 0, 0],
    [encode(''), 1, 0x51_4E_28_B7],
    [encode(''), 0xFF_FF_FF_FF, 0x81_F1_6F_39],
    [Uint8Array.of(0x21), 0, 0x72_66_1C_F4],
    [Uint8Array.of(0x21, 0x43, 0x65), 0, 0x7E_4A_86_34],
    [Uint8Array.of(0x21, 0x43, 0x65, 0x87), 0, 0xF5_5B_51_6B],
    [Uint8Array.of(0xFF, 0xFF, 0xFF, 0xFF), 0, 0x76_29_3B_50],
    [encode('ab'), 0x97_47_B2_8C, 0x74_87_55_92],
    [encode('abcd'), 0x97_47_B2_8C, 0xF0_47_86_27],
    [encode('Hello, world!'), 1234, 0xFA_F6_CD_B3],
    [encode('The quick brown fox jumps over the lazy dog'), 0, 0x2E_4F_F7_23],
  ] as const) {
    expect(murmur3(bytes, seed)).toBe(hash)
  }
})
test('hashed seeds spread evenly over the whole range', () => {
  const amount = 655_360
  const counts = new Uint32Array(maximumSeed)
  for (let i = 0; i < amount; i++) {
    counts[rollSeed(`spot-${i}`) - 1]++
  }
  const expected = amount / maximumSeed
  const chiSquared = counts.reduce((sum, count) => sum + (count - expected) ** 2 / expected, 0)
  expect(chiSquared / (maximumSeed - 1)).toBeWithin(0.97, 1.03)
})
test('hashed seeds stay what they were, as saved worlds rely on them', () => {
  expect({
    text: rollSeed('Hanover'),
    empty: rollSeed(''),
    bytes: rollSeed(Uint8Array.of(1, 2, 3)),
    emptyBytes: rollSeed(new Uint8Array(0)),
    fraction: rollSeed(2.5),
    nan: rollSeed(Number.NaN),
  }).toEqual({
    text: 45_352,
    empty: 19_203,
    bytes: 52_076,
    emptyBytes: 15_711,
    fraction: 921,
    nan: 40_748,
  })
})
test('anything but numbers, text and bytes is refused', () => {
  for (const input of [null, {}, [1, 2], Uint16Array.of(1), 1n]) {
    expect(() => rollSeed(input as unknown as string)).toThrow(TypeError)
  }
})
