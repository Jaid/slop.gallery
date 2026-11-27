import {describe, expect, test} from 'bun:test'

import {mulberry32} from 'math/random'
import {Box3, Vector3} from 'three/webgpu'

import {crustStrokes} from '../../src/frames/impasto/ImpastoFrame.ts'
import {choiceFrames} from '../../src/frames/lib/frameChoice.ts'
import {impastoIndex, impastoOrder, impastoPaints} from '../../src/lib/materials/impastoPaints.ts'
import {moods} from '../../src/moods/index.ts'
import ImpastoOrbMaterial from '../../src/orbs/impasto/ImpastoOrbMaterial.ts'
import {impastoBubbles, impastoPalette, impastoStrokes, strokeBoundRadius, strokeDistance, strokeSurfaceDistance} from '../../src/orbs/impasto/strokes.ts'
import {impastoOrb, orbRadius, paintOrb, promptOrbs, randomOrbs} from '../../src/orbs/index.ts'

describe('Impasto Orb', () => {
  test('offers the Impasto prompt and frame on the Vesper pedestals, with its own ambience and glow', () => {
    expect(promptOrbs).toContain(impastoOrb)
    expect(impastoOrb.conjunction).toBe('and')
    expect(randomOrbs).toContain(impastoOrb)
    expect(choiceFrames(impastoOrb.frame)).toContain('impasto')
    expect(impastoOrb.ingredient(0).contributions).toContainEqual({
      kind: 'canvasMaterial',
      canvasMaterial: 'impasto',
    })
    expect(moods[impastoOrb.mood].ambience).not.toBe(moods[paintOrb.mood].ambience)
    const glows = promptOrbs.filter(orb => orb !== impastoOrb).map(orb => orb.color)
    expect(glows).not.toContain(impastoOrb.color)
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
    expect(impastoStrokes.length).toBeGreaterThan(0)
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
  test('the paint fits its baked boxes and the raymarch sphere, clear of neighboring strokes', () => {
    const state = mulberry32.create(1)
    const random = () => mulberry32.sample(state)
    const local = new Vector3
    const point = new Vector3
    const margin = 0.06
    for (const stroke of impastoStrokes) {
      const bounds = new Box3(stroke.boxMin, stroke.boxMax)
      const paint = new Box3
      const others = impastoStrokes.filter(other => other !== stroke)
      let radius = 0
      let clearance = Infinity
      // Sample beyond each face to catch paint the marcher would clip.
      for (let sample = 0; sample < 40_000; sample++) {
        const x = stroke.boxMin.x - margin + random() * (stroke.boxMax.x - stroke.boxMin.x + margin * 2)
        const y = stroke.boxMin.y - margin + random() * (stroke.boxMax.y - stroke.boxMin.y + margin * 2)
        const z = stroke.boxMin.z - margin + random() * (stroke.boxMax.z - stroke.boxMin.z + margin * 2)
        point.set(0, 0, 0).addScaledVector(stroke.along, x).addScaledVector(stroke.across, y).addScaledVector(stroke.normal, z)
        if (strokeDistance(point, stroke) >= strokeSurfaceDistance) {
          continue
        }
        paint.expandByPoint(local.set(x, y, z))
        radius = Math.max(radius, point.length())
        if (sample % 8 === 0) {
          for (const other of others) {
            clearance = Math.min(clearance, strokeDistance(point, other))
          }
        }
      }
      expect(paint.isEmpty()).toBe(false)
      expect(bounds.containsBox(paint)).toBe(true)
      expect(radius).toBeLessThan(strokeBoundRadius)
      expect(clearance).toBeFinite()
      expect(clearance).toBeGreaterThan(strokeSurfaceDistance)
    }
  })
  test('trapped bubbles clear the paint, the glass rim and one another', () => {
    expect(impastoBubbles.length).toBeGreaterThan(0)
    for (const [index, bubble] of impastoBubbles.entries()) {
      expect(bubble.radius).toBeGreaterThan(0)
      expect(bubble.center.length() + bubble.radius).toBeLessThan(0.74)
      for (const stroke of impastoStrokes) {
        expect(strokeDistance(bubble.center, stroke)).toBeGreaterThan(bubble.radius + 0.007)
      }
      for (const other of impastoBubbles.slice(index + 1)) {
        expect(bubble.center.distanceTo(other.center)).toBeGreaterThan(bubble.radius + other.radius)
      }
    }
  })
})
