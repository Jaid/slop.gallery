import {expect, test} from 'bun:test'

import {orbRadius, orbs, promptOrbs} from '../../src/orbs/index.ts'

test('each prompt orb has a distinct sRGB glow', () => {
  const colors = promptOrbs.map(orb => orb.color)
  const unique = new Set(colors)
  expect(unique.size).toBe(colors.length)
  for (const color of colors) {
    expect(color).toBeInteger()
    expect(color).toBeWithin(0, 2 ** 24)
  }
})
for (const orb of orbs) {
  test(`${orb.title} instances own their glass and write depth while transmitting light`, () => {
    const first = orb.createMaterial({radius: orbRadius})
    const second = orb.createMaterial({radius: orbRadius})
    try {
      expect(first).not.toBe(second)
      expect(first.emissiveNode).not.toBeNull()
      expect(first.emissionIsTransmission).toBe(true)
      expect(first.depthWrite).toBe(true)
      expect(first.opacity).toBe(1)
    } finally {
      first.dispose()
      second.dispose()
    }
  })
}
