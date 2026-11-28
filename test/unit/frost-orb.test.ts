import {describe, expect, test} from 'bun:test'

import {frames} from '../../src/frames/index.ts'
import {frameShapeAttribute, ornamentMember} from '../../src/frames/lib/frameGeometry.ts'
import Hoarfrost from '../../src/moods/frost/Hoarfrost.ts'
import {moods} from '../../src/moods/index.ts'
import {frostOrb} from '../../src/orbs/index.ts'
import {blizzardParticles} from '../../src/party_effects/blizzard/flights.ts'
import {partyEffects} from '../../src/party_effects/index.ts'

describe('Frost Orb', () => {
  test('offers each of its frames across seeds and brings a blizzard and hoarfrost', () => {
    const ingredients = Array.from({length: 32}, (_, seed) => frostOrb.ingredient(seed))
    const rolled = ingredients.flatMap(({contributions}) => contributions.filter(part => part.kind === 'frame').map(part => part.frame))
    expect(new Set(rolled)).toEqual(new Set(frostOrb.frame))
    expect(frostOrb.partyEffect(3)).toBe('blizzard')
    expect(moods[frostOrb.mood].screen).toBeInstanceOf(Hoarfrost)
  })
})
describe('Glacier frame', () => {
  test('heaps its snow on top, facing out, and hangs its icicles below, all within the frame’s reach', () => {
    const glacier = frames.glacier
    for (const [width, height] of [[1.2, 0.8], [0.6, 0.6], [3, 2]]) {
      const geometry = glacier.createGeometry(width, height)
      try {
        const position = geometry.getAttribute('position')
        const normal = geometry.getAttribute('normal')
        const shape = geometry.getAttribute(frameShapeAttribute)
        const ofMaterial = (material: number) => {
          const group = geometry.groups.find(candidate => candidate.materialIndex === material)!
          return Array.from({length: group.count}, (_, index) => group.start + index)
        }
        // The snow’s highest point faces up, so it catches the light instead of turning its inside out.
        const snow = ofMaterial(1).filter(index => shape.getX(index) >= ornamentMember)
        const top = snow.reduce((highest, index) => (position.getY(index) > position.getY(highest) ? index : highest))
        expect(position.getY(top)).toBeGreaterThan(height / 2 + 0.1)
        expect(position.getY(top)).toBeLessThanOrEqual(height / 2 + glacier.reach + 1e-6)
        expect(normal.getY(top)).toBeGreaterThan(0.5)
        // The icicles hang below the frame’s bottom edge, their lowest tips within its reach.
        const icicles = ofMaterial(2)
        expect(icicles.length).toBeGreaterThan(0)
        const lowest = Math.min(...icicles.map(index => position.getY(index)))
        expect(lowest).toBeLessThan(-height / 2 - 0.1)
        expect(lowest).toBeGreaterThanOrEqual(-height / 2 - glacier.reach - 1e-6)
        for (const index of [...snow, ...icicles]) {
          expect(position.getZ(index)).toBeLessThanOrEqual(glacier.front + 1e-6)
        }
      } finally {
        geometry.dispose()
      }
    }
  })
})
describe('blizzard', () => {
  test('stages all four kinds in one draw and keeps the portal open until the last particle is gone', () => {
    const effect = partyEffects.blizzard
    const sprites = effect.createSprites()
    try {
      expect(new Set(blizzardParticles.map(particle => particle.kind))).toEqual(new Set([0, 1, 2, 3]))
      expect(sprites.count).toBe(blizzardParticles.length)
      expect(effect.duration).toBeGreaterThanOrEqual(Math.max(...blizzardParticles.map(({delay, life}) => delay + life)))
    } finally {
      sprites.dispose()
    }
  })
})
