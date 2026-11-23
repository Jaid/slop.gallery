import {describe, expect, test} from 'bun:test'

import {Vector3} from 'three/webgpu'

import {crustStrokes} from '../../src/frames/impasto/ImpastoFrame.ts'
import {frames} from '../../src/frames/index.ts'
import {choiceFrames} from '../../src/frames/lib/frameChoice.ts'
import {impastoColor, impastoIndex, impastoOrder, impastoPaints} from '../../src/lib/materials/impastoPaints.ts'
import {moods} from '../../src/moods/index.ts'
import ImpastoOrbMaterial from '../../src/orbs/impasto/ImpastoOrbMaterial.ts'
import {capSurelyCovers, impastoBall, impastoCandidates, impastoCourses, impastoStrokes, strokeMayCover, strokeSurelyCovers} from '../../src/orbs/impasto/strokes.ts'
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
  test('lays the knife strokes of its glass in courses from the bottom up, each stroke on the ball with orthonormal axes and a paint of its own palette', () => {
    expect(impastoStrokes.length).toBeGreaterThan(60)
    expect(impastoCourses.map(course => course.start)).toEqual(impastoCourses.map((_, index) => impastoCourses.slice(0, index).reduce((sum, course) => sum + course.count, 0)))
    for (const [index, {across, along, center, course, cell, layer, paint}] of impastoStrokes.entries()) {
      for (const axis of [center, along, across]) {
        expect(axis.length()).toBeCloseTo(1, 9)
      }
      expect(along.dot(across)).toBeCloseTo(0, 9)
      expect(along.dot(center)).toBeCloseTo(0, 9)
      expect(across.dot(center)).toBeCloseTo(0, 9)
      expect(impastoOrder[paint]).toBeDefined()
      // Each course lies over the one below, its strokes in an order of their own.
      const {count, start} = impastoCourses[course]
      expect(index).toBe(start + cell)
      expect(layer).toBeGreaterThanOrEqual(start)
      expect(layer).toBeLessThan(start + count)
    }
    const layers = new Set(impastoStrokes.map(stroke => stroke.layer))
    expect(layers.size).toBe(impastoStrokes.length)
  })
  test('keeps the paint inside the glass, with clear glass around it', () => {
    expect(impastoBall.core).toBeGreaterThan(0)
    expect(impastoBall.core + impastoBall.relief).toBeLessThan(0.85)
  })
  // Points spread evenly over the ball by a Fibonacci lattice, the poles included.
  const lattice = 40_000
  const directions = Array.from({length: lattice}, (_, index) => {
    const y = 1 - (index + 0.5) * 2 / lattice
    const radial = Math.sqrt(1 - y * y)
    const angle = index * Math.PI * (3 - Math.sqrt(5))
    return new Vector3(radial * Math.cos(angle), y, radial * Math.sin(angle))
  })
  test('buries its core: every direction lies fully under a stroke or a pole’s dab, however far their torn edges stray in', () => {
    const bare = directions.filter(direction => !capSurelyCovers(direction) && !impastoStrokes.some(stroke => strokeSurelyCovers(stroke, direction)))
    expect(bare).toEqual([])
  })
  test('its shader looks at every stroke that may reach a direction, however far their torn edges stray out', () => {
    for (const direction of directions) {
      const candidates = impastoCandidates(direction)
      for (const [index, stroke] of impastoStrokes.entries()) {
        if (strokeMayCover(stroke, direction) && !candidates.has(index)) {
          throw new Error(`The stroke ${index} reaches (${direction.x.toFixed(3)}, ${direction.y.toFixed(3)}, ${direction.z.toFixed(3)}) without the shader looking at it.`)
        }
      }
    }
  })
  test('sets strokes of the same paint side by side in a course rarely', () => {
    const repeats = impastoCourses.reduce((sum, {count, start}) => sum + Array.from({length: count}, (_, cell) => impastoStrokes[start + cell].paint === impastoStrokes[start + (cell + 1) % count].paint).filter(Boolean).length, 0)
    expect(repeats / impastoStrokes.length).toBeLessThan(0.15)
  })
})
