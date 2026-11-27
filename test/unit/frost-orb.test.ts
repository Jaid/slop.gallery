import {describe, expect, test} from 'bun:test'

import {choiceFrames} from '../../src/frames/lib/frameChoice.ts'
import {windowFrost} from '../../src/moods/frost/WindowFrost.ts'
import {moods} from '../../src/moods/index.ts'
import BlizzardOrbMaterial from '../../src/orbs/frost/BlizzardOrbMaterial.ts'
import {frostOrb, orbRadius, promptOrbs, randomOrbs} from '../../src/orbs/index.ts'
import {flakeOffset, snowflakes} from '../../src/party_effects/flurry/flights.ts'
import {partyEffects} from '../../src/party_effects/index.ts'

describe('Frost Orb', () => {
  test('offers the Frost prompt, an icy frame and its flurry on the Vesper pedestals, with a blizzard mood and a glow of its own', () => {
    expect(promptOrbs).toContain(frostOrb)
    expect(randomOrbs).toContain(frostOrb)
    expect(frostOrb.mood).toBe('frost')
    expect(choiceFrames(frostOrb.frame)).toContain('acrylic')
    expect(partyEffects[frostOrb.effect].id).toBe('flurry')
    const mood = moods[frostOrb.mood]
    expect(mood.screen).toBeDefined()
    expect(mood.ambience).toBeDefined()
    const glows = promptOrbs.filter(orb => orb !== frostOrb).map(orb => orb.color)
    expect(glows).not.toContain(frostOrb.color)
    for (let seed = 0; seed < 40; seed++) {
      expect(frostOrb.prompt(seed)).toContain('blizzard')
    }
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
      expect(first.opacity).toBe(1)
    } finally {
      first.dispose()
      second.dispose()
    }
  })
  test('the blizzard’s window frost never reaches the middle of the view, however far its front and tendrils stretch', () => {
    const furthest = windowFrost.reach * (windowFrost.base + windowFrost.wobble) + windowFrost.tendril + windowFrost.corner
    expect(furthest).toBeLessThan(0.5)
    expect(windowFrost.growSeconds).toBeGreaterThan(0)
  })
  test('every flake of its flurry bursts out of the origin, drifts into the room, sinks as it goes and never falls through the floor', () => {
    const floor = -1.7
    expect(snowflakes.length).toBeGreaterThan(100)
    // Most flakes are fine snow and a good handful great stellar ones.
    expect(snowflakes.filter(({size}) => size > 0.1).length).toBeGreaterThan(8)
    expect(snowflakes.filter(({size}) => size <= 0.1).length).toBeGreaterThan(snowflakes.length * 0.8)
    for (const flake of snowflakes) {
      const [along, up, out] = flakeOffset(flake, 0, floor)
      expect(along).toBeCloseTo(0, 9)
      expect(up).toBeCloseTo(0, 9)
      expect(out).toBeCloseTo(0.05, 9)
      const steps = 24
      for (let step = 0; step <= steps; step++) {
        const offset = flakeOffset(flake, flake.life * step / steps, floor)
        expect(offset.every(Number.isFinite)).toBe(true)
        expect(offset[1]).toBeGreaterThanOrEqual(floor + flake.size * 0.5 - 1e-9)
      }
      // Given time, every flake comes to rest on the floor.
      const [, landed] = flakeOffset(flake, flake.life + 10, -0.6)
      expect(landed).toBeCloseTo(-0.6 + flake.size * 0.5, 9)
      const [, , outByThen] = flakeOffset(flake, flake.life, floor)
      expect(outByThen).toBeGreaterThan(0.3)
      expect(flake.delay).toBeGreaterThan(0)
      expect(flake.life).toBeGreaterThan(2)
    }
    // Nearly all of them sink well below where the burst carried them; a few ride the gust upward to the end.
    const sinking = snowflakes.filter(flake => flakeOffset(flake, flake.life, floor)[1] < flakeOffset(flake, 0.5, floor)[1] - 0.2)
    expect(sinking.length).toBeGreaterThan(snowflakes.length * 0.9)
    const delays = snowflakes.map(({delay}) => delay)
    expect(Math.max(...delays) - Math.min(...delays)).toBeGreaterThan(0.8)
    expect(partyEffects.flurry.duration).toBeCloseTo(Math.max(...snowflakes.map(({delay, life}) => delay + life)), 9)
  })
})
