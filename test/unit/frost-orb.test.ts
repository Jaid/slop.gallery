import {describe, expect, test} from 'bun:test'

import {frames} from '../../src/frames/index.ts'
import {choiceFrames} from '../../src/frames/lib/frameChoice.ts'
import {frameShapeAttribute, ornamentMember} from '../../src/frames/lib/frameGeometry.ts'
import MoodScreen from '../../src/moods/base/MoodScreen.ts'
import Hoarfrost from '../../src/moods/frost/Hoarfrost.ts'
import {moods, moodScreens} from '../../src/moods/index.ts'
import BlizzardOrbMaterial from '../../src/orbs/frost/BlizzardOrbMaterial.ts'
import {frostOrb, orbRadius, orbs, promptOrbs, randomOrbs} from '../../src/orbs/index.ts'
import {crystalChime} from '../../src/party_effects/blizzard/blizzardGust.ts'
import {blownFlakes, flakeOffset, flakeRest, largeCrystal} from '../../src/party_effects/blizzard/flights.ts'
import {partyEffects} from '../../src/party_effects/index.ts'

describe('Frost Orb', () => {
  test('brings its winter prompt, the Glacier frame, the blizzard and a mood of its own with a glow no other orb has, and turns up on the Vesper’s pedestals', () => {
    expect(promptOrbs).toContain(frostOrb)
    expect(randomOrbs).toContain(frostOrb)
    expect(choiceFrames(frostOrb.frame)).toEqual(['glacier'])
    expect(frostOrb.partyEffect(3)).toBe('blizzard')
    expect(frostOrb.prompt(3)).toMatch(/winter storm/)
    const mood = moods[frostOrb.mood]
    expect(mood.screen).toBeInstanceOf(Hoarfrost)
    expect(moodScreens).toContain(mood.screen)
    expect(mood.grade).toBeDefined()
    const ambiences = new Set(orbs.flatMap(orb => (orb.mood ? [moods[orb.mood].ambience] : [])))
    expect(ambiences.size).toBe(orbs.filter(orb => orb.mood).length)
    const glows = promptOrbs.filter(orb => orb !== frostOrb).map(orb => orb.color)
    expect(glows).not.toContain(frostOrb.color)
  })
  test('creates a glass material of its own for every orb, opaque to depth despite its transmission', () => {
    const first = frostOrb.createMaterial({radius: orbRadius})
    const second = frostOrb.createMaterial({radius: orbRadius})
    try {
      expect(first).toBeInstanceOf(BlizzardOrbMaterial)
      expect(first).not.toBe(second)
      expect(first.name).toBe('orb-blizzard')
      expect(first.emissiveNode).toBeTruthy()
      expect(first.emissionIsTransmission).toBe(true)
      expect(first.depthWrite).toBe(true)
    } finally {
      first.dispose()
      second.dispose()
    }
  })
  test('its mood’s screen only shows while the mood does', () => {
    const {screen} = moods.frost
    expect(screen).toBeInstanceOf(MoodScreen)
    expect(screen.showing).toBe(false)
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
  test('bursts out of its origin and blows out into the room, the large crystals larger than every little flake, and settles on the floor without sinking through it', () => {
    const effect = partyEffects.blizzard
    expect(effect.duration).toBe(Math.max(...blownFlakes.map(({delay, life}) => delay + life)))
    const crystals = blownFlakes.filter(({size}) => size >= largeCrystal)
    expect(crystals.length).toBeGreaterThan(8)
    expect(blownFlakes.length - crystals.length).toBeGreaterThan(crystals.length)
    // Every large crystal rings a note of its own, descending, however many there are.
    const notes = crystals.map((_, index) => crystalChime(index))
    expect(notes.every(note => Number.isFinite(note) && note > 200 && note < 6000)).toBe(true)
    const distinct = new Set(notes)
    expect(distinct.size).toBe(notes.length)
    expect(notes).toEqual(notes.toSorted((a, b) => b - a))
    const floor = -1.7
    for (const flake of blownFlakes) {
      expect([0, 1]).toContain(flake.design)
      for (const [axis, value] of flakeOffset(flake, 0).entries()) {
        expect(value).toBeCloseTo([0, 0, 0.05][axis], 9)
      }
      expect(flakeOffset(flake, flake.life)[2]).toBeGreaterThan(0.2)
      for (const seconds of [0, flake.life * 0.5, flake.life, flake.life * 4]) {
        expect(flakeOffset(flake, seconds, floor)[1]).toBeGreaterThanOrEqual(floor + flakeRest - 1e-9)
      }
    }
  })
})
