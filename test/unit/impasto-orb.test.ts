import {describe, expect, test} from 'bun:test'

import {Vector3} from 'three/webgpu'

import {crustStrokes} from '../../src/frames/impasto/ImpastoFrame.ts'
import {frames} from '../../src/frames/index.ts'
import {choiceFrames} from '../../src/frames/lib/frameChoice.ts'
import {impastoColor, impastoIndex, impastoOrder, impastoPaints} from '../../src/lib/materials/impastoPaints.ts'
import {moods} from '../../src/moods/index.ts'
import ImpastoOrbMaterial from '../../src/orbs/impasto/ImpastoOrbMaterial.ts'
import {impastoBubbles, impastoPalette, impastoStrokes, strokeDistance} from '../../src/orbs/impasto/strokes.ts'
import {impastoOrb, orbRadius, paintOrb, promptOrbs, randomOrbs, transparentOrb} from '../../src/orbs/index.ts'
import {partyEffects} from '../../src/party_effects/index.ts'

describe('Impasto Orb', () => {
  test('asks the image model for a digital impasto artwork of the work that keeps its content intact, every one of the traits it names', () => {
    for (let seed = 0; seed < 200; seed++) {
      const prompt = impastoOrb.prompt(seed)
      expect(prompt).toContain('Please edit this image and change it to a high-quality digital impasto artwork while keeping the original content intact.')
      // All of them, not one of them to pick.
      expect(prompt).toMatch(/ and [\w-]+(?: [\w-]+)?\.$/u)
      expect(prompt).not.toMatch(/ or [\w-]+(?: [\w-]+)?\.$/u)
    }
    // The traits the gallery asked for are all among its own.
    const named = impastoOrb.adjectives.flat()
    for (const trait of ['detailed', 'cohesive', 'atmospheric', 'tactile', 'bold']) {
      expect(named).toContain(trait)
    }
  })
  test('brings a frame and a party effect of its own, casts its own workshop mood, glows a color of its own and leaves a Transparent Orb', () => {
    expect(promptOrbs).toContain(impastoOrb)
    expect(choiceFrames(impastoOrb.frame)).toEqual(['impasto'])
    for (const frame of choiceFrames(impastoOrb.frame)) {
      expect(frames[frame]).toBeDefined()
    }
    expect(moods[impastoOrb.mood].ambience).not.toBe(moods[paintOrb.mood].ambience)
    expect(moods[impastoOrb.mood].title).toBeTruthy()
    expect(impastoOrb.partyEffect(1)).toBe('smears')
    expect(partyEffects.smears.id).toBe('smears')
    expect(impastoOrb.remains).toBe(transparentOrb)
    const glows = promptOrbs.filter(orb => orb !== impastoOrb).map(orb => orb.color)
    expect(glows).not.toContain(impastoOrb.color)
  })
  test('turns up on the Vesper’s pedestals like the friendly orbs', () => {
    expect(randomOrbs).toContain(impastoOrb)
  })
  test('every knife stroke of its frame’s crust stays within its own cell and the next along and across, all its frame’s material looks at', () => {
    const {across, along, halfWidth, length, lip, slant, squeezed, start, wander} = crustStrokes
    const reach = length[1] + lip
    const side = halfWidth[1] * (1 + squeezed)
    for (const angle of [slant - wander, slant, slant + wander]) {
      const [cos, sin] = [Math.cos(angle), Math.sin(angle)]
      // The stroke runs forward and up out of where it starts, its sides reaching out across that way.
      const lowX = start[0] * along - sin * side
      const highX = start[1] * along + cos * reach + sin * side
      const lowY = start[0] * across - cos * side
      const highY = start[1] * across + sin * reach + cos * side
      expect(lowX).toBeGreaterThanOrEqual(0)
      expect(highX).toBeLessThan(along * 2)
      expect(lowY).toBeGreaterThanOrEqual(0)
      expect(highY).toBeLessThan(across * 2)
    }
  })
  test('its paints go by their order, each its own color', () => {
    expect(impastoOrder.map(impastoIndex)).toEqual(impastoOrder.map((_, index) => index))
    const colors = new Set(Object.values(impastoPaints))
    expect(colors.size).toBe(impastoOrder.length)
    expect(impastoColor).toBeFunction()
  })
  test('creates a glass material of its own for every orb, opaque to depth despite its transmission', () => {
    const first = impastoOrb.createMaterial({radius: orbRadius})
    const second = impastoOrb.createMaterial({radius: orbRadius})
    try {
      expect(first).toBeInstanceOf(ImpastoOrbMaterial)
      expect(first).not.toBe(second)
      expect(first.name).toBe('orb-impasto')
      expect(first.emissiveNode).toBeTruthy()
      expect(first.emissionIsTransmission).toBe(true)
      expect(first.depthWrite).toBe(true)
      expect(first.opacity).toBe(1)
    } finally {
      first.dispose()
      second.dispose()
    }
  })
  test('keeps every curved stroke’s bounding box inside the glass, with orthonormal axes and paired paints of its palette', () => {
    expect(impastoStrokes.length).toBeGreaterThanOrEqual(12)
    for (const {across, along, boxMax, boxMin, folded, normal, pigment} of impastoStrokes) {
      for (const axis of [along, across, normal]) {
        expect(axis.length()).toBeCloseTo(1, 9)
      }
      expect(along.dot(across)).toBeCloseTo(0, 9)
      expect(along.dot(normal)).toBeCloseTo(0, 9)
      expect(across.dot(normal)).toBeCloseTo(0, 9)
      expect(pigment).toBeGreaterThanOrEqual(0)
      expect(pigment).toBeLessThan(impastoPalette.length)
      expect(folded).toBeGreaterThanOrEqual(0)
      expect(folded).toBeLessThan(impastoPalette.length)
      expect(folded).not.toBe(pigment)
      expect(boxMin.x).toBeLessThan(boxMax.x)
      expect(boxMin.y).toBeLessThan(boxMax.y)
      expect(boxMin.z).toBeLessThan(boxMax.z)
      for (const x of [boxMin.x, boxMax.x]) {
        for (const y of [boxMin.y, boxMax.y]) {
          for (const z of [boxMin.z, boxMax.z]) {
            const corner = new Vector3
            corner.addScaledVector(along, x).addScaledVector(across, y).addScaledVector(normal, z)
            expect(corner.length()).toBeLessThan(0.95)
          }
        }
      }
    }
  })
  test('keeps all sculpted strokes strictly separated with zero clipping and every trapped bubble clear of the paint and glass', () => {
    const point = new Vector3
    for (const [index, stroke] of impastoStrokes.entries()) {
      let insideSamples = 0
      for (let iu = -8; iu <= 8; iu++) {
        const u = iu / 7
        const theta = u * stroke.arc / stroke.shell
        for (let iv = -4; iv <= 4; iv++) {
          const v = iv / 3.5
          const whip = Math.max(0, u - 0.15)
          const hook = stroke.bend * (u * u * 0.7 - 0.18 + 0.85 * whip * whip * stroke.tilt)
          const asymT = Math.max(0, Math.min(1, (u - 0.08) / 0.88))
          const asym = stroke.width * 0.34 * stroke.tilt * asymT * asymT * (3 - 2 * asymT)
          const arcAcross = v * stroke.width * 1.15 + hook + asym
          const phiAcross = arcAcross / stroke.shell
          for (let ih = -2; ih <= 5; ih++) {
            const radius = stroke.shell + ih / 4 * (stroke.thick * 2.2 + stroke.lift)
            if (radius <= 0.02) {
              continue
            }
            const rxz = radius * Math.cos(phiAcross)
            const lx = rxz * Math.sin(theta)
            const ly = radius * Math.sin(phiAcross)
            const lz = rxz * Math.cos(theta)
            point.set(0, 0, 0).addScaledVector(stroke.along, lx).addScaledVector(stroke.across, ly).addScaledVector(stroke.normal, lz)
            if (strokeDistance(point, stroke) > 0.002) {
              continue
            }
            insideSamples++
            // Keep every paint surface well inside the refracted silhouette (r * fillIor < 0.90) so a clean golden glass rim always frames the sculpture.
            expect(point.length()).toBeLessThan(0.7)
            expect(lx).toBeGreaterThanOrEqual(stroke.boxMin.x)
            expect(lx).toBeLessThanOrEqual(stroke.boxMax.x)
            expect(ly).toBeGreaterThanOrEqual(stroke.boxMin.y)
            expect(ly).toBeLessThanOrEqual(stroke.boxMax.y)
            expect(lz).toBeGreaterThanOrEqual(stroke.boxMin.z)
            expect(lz).toBeLessThanOrEqual(stroke.boxMax.z)
            for (const [otherIndex, other] of impastoStrokes.entries()) {
              if (otherIndex !== index) {
                expect(strokeDistance(point, other)).toBeGreaterThan(0.015)
              }
            }
          }
        }
      }
      expect(insideSamples).toBeGreaterThan(10)
    }
    expect(impastoBubbles.length).toBeGreaterThanOrEqual(50)
    expect(impastoBubbles.filter(bubble => bubble.center.y > 0.2).length).toBeGreaterThan(10)
    expect(impastoBubbles.filter(bubble => bubble.center.y < -0.2).length).toBeGreaterThan(10)
    for (const [index, bubble] of impastoBubbles.entries()) {
      expect(bubble.center.length() + bubble.radius).toBeLessThan(0.74)
      for (const stroke of impastoStrokes) {
        expect(strokeDistance(bubble.center, stroke)).toBeGreaterThan(bubble.radius + 0.007)
      }
      for (const [otherIndex, other] of impastoBubbles.entries()) {
        if (otherIndex !== index) {
          expect(bubble.center.distanceTo(other.center)).toBeGreaterThan(bubble.radius + other.radius)
        }
      }
    }
  })
})
