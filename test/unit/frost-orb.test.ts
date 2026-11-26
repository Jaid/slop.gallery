import {describe, expect, test} from 'bun:test'

import {mulberry32} from 'math/random'
import {Vector3} from 'three/webgpu'

import {choiceFrames} from '../../src/frames/lib/frameChoice.ts'
import FrostAmbience from '../../src/moods/frost/FrostAmbience.ts'
import FrostScreen from '../../src/moods/frost/FrostScreen.ts'
import {moods, moodScreens} from '../../src/moods/index.ts'
import {crystalBoundRadius, crystalDistance, frostFillIor, frostFlakes} from '../../src/orbs/frost/crystal.ts'
import FrostOrbMaterial from '../../src/orbs/frost/FrostOrbMaterial.ts'
import {frostOrb, orbRadius, promptOrbs, randomOrbs} from '../../src/orbs/index.ts'
import {blizzardDone, blizzardOffset, blizzardParticles} from '../../src/party_effects/blizzard/flights.ts'
import {partyEffects} from '../../src/party_effects/index.ts'

describe('Frost Orb', () => {
  test('offers its winter prompt, glacier frame, blizzard effect, unique glow, ambience and corner-frost screen on the Vesper pedestals', () => {
    expect(promptOrbs).toContain(frostOrb)
    expect(randomOrbs).toContain(frostOrb)
    expect(frostOrb.conjunction).toBe('and')
    expect(frostOrb.effect).toBe('blizzard')
    expect(choiceFrames(frostOrb.frame)).toEqual(['frost'])
    const mood = moods[frostOrb.mood]
    expect(mood.ambience).toBe(FrostAmbience)
    expect(mood.screen).toBeInstanceOf(FrostScreen)
    expect(moodScreens).toContain(mood.screen)
    const otherGlows = promptOrbs.filter(orb => orb !== frostOrb).map(orb => orb.color)
    expect(otherGlows).not.toContain(frostOrb.color)
  })
  test('creates a glass material of its own for every orb, opaque to depth despite its transmission', () => {
    const first = frostOrb.createMaterial({radius: orbRadius})
    const second = frostOrb.createMaterial({radius: orbRadius})
    try {
      expect(first).toBeInstanceOf(FrostOrbMaterial)
      expect(first).not.toBe(second)
      expect(first.name).toBe('orb-frost')
      expect(first.emissiveNode).toBeTruthy()
      expect(first.emissionIsTransmission).toBe(true)
      expect(first.depthWrite).toBe(true)
      expect(first.opacity).toBe(1)
    } finally {
      first.dispose()
      second.dispose()
    }
  })
  test('keeps its 3D octahedral snowflake-star crystal strictly inside the glass rim with exact 48-fold symmetry', () => {
    // Solid jewel core and distinct arms along every primary and diagonal axis.
    expect(crystalDistance(new Vector3(0, 0, 0))).toBeLessThan(-0.08)
    for (const axis of [
      new Vector3(0.5, 0, 0),
      new Vector3(-0.5, 0, 0),
      new Vector3(0, 0.5, 0),
      new Vector3(0, -0.5, 0),
      new Vector3(0, 0, 0.5),
      new Vector3(0, 0, -0.5),
    ]) {
      expect(crystalDistance(axis)).toBeLessThan(0)
    }
    const diag = 0.36 / Math.sqrt(3)
    expect(crystalDistance(new Vector3(diag, -diag, diag))).toBeLessThan(0)
    // Exact Oh symmetry across arbitrary signed permutations.
    const probe = new Vector3(0.31, 0.14, 0.05)
    const expected = crystalDistance(probe)
    for (const [x, y, z] of [
      [-0.31, 0.14, 0.05],
      [0.14, -0.31, -0.05],
      [0.05, 0.14, -0.31],
      [-0.05, -0.31, 0.14],
    ]) {
      expect(crystalDistance(new Vector3(x, y, z))).toBeCloseTo(expected, 12)
    }
    // Monte Carlo check across the sphere: every solid point stays inside `crystalBoundRadius` so `r * fillIor < 0.85` preserves a clean icy glass rim.
    const rng = mulberry32.create(42)
    const point = new Vector3
    let maxRadius = 0
    for (let sample = 0; sample < 60_000; sample++) {
      point.set(mulberry32.sample(rng) * 2 - 1, mulberry32.sample(rng) * 2 - 1, mulberry32.sample(rng) * 2 - 1)
      if (point.lengthSq() > 1) {
        continue
      }
      if (crystalDistance(point) < 0) {
        maxRadius = Math.max(maxRadius, point.length())
      }
    }
    // Primary arm tips extend to r = 0.57 cleanly inside `crystalBoundRadius`.
    expect(crystalDistance(new Vector3(0.565, 0, 0))).toBeLessThan(0)
    expect(crystalDistance(new Vector3(0.575, 0, 0))).toBeGreaterThan(0)
    expect(maxRadius).toBeGreaterThan(0.4)
    expect(maxRadius).toBeLessThan(crystalBoundRadius)
    expect(Math.max(maxRadius, 0.57) * frostFillIor).toBeLessThan(0.85)
  })
  test('keeps all orbiting snow motes and sparkling micro-crystals well inside the refracted glass sphere', () => {
    expect(frostFlakes.length).toBeGreaterThan(40)
    for (const flake of frostFlakes) {
      expect(flake.size).toBeGreaterThan(0)
      expect(flake.radius).toBeGreaterThan(0)
      // Include maximum vertical bobbing amplitude (0.045 + 0.025 = 0.07) so motes never clip the glass rim.
      const maxExtent = Math.hypot(flake.radius, Math.abs(flake.height) + 0.07) + flake.size
      expect(maxExtent).toBeLessThan(0.76)
      expect(maxExtent * frostFillIor).toBeLessThan(1)
    }
  })
  test('its blizzard party effect combines squalls, snowflakes, glacier shards and frost motes, never sinking below the floor', () => {
    const kinds = new Set(blizzardParticles.map(particle => particle.kind))
    expect(kinds).toEqual(new Set([0, 1, 2, 3]))
    expect(partyEffects.blizzard.duration).toBe(blizzardDone)
    for (const floor of [-2.2, -1.8, -1.2]) {
      for (const particle of blizzardParticles) {
        for (const share of [0, 0.25, 0.5, 0.75, 1]) {
          const [, up, out] = blizzardOffset(particle, particle.life * share, floor)
          expect(up).toBeGreaterThanOrEqual(floor)
          expect(out).toBeGreaterThan(0)
        }
      }
    }
  })
})
