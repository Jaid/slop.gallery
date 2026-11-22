import {describe, expect, test} from 'bun:test'

import {Color, DataUtils, HalfFloatType, LinearFilter, RepeatWrapping} from 'three/webgpu'

import {crustStrokes} from '../../src/frames/impasto/ImpastoFrame.ts'
import {frames} from '../../src/frames/index.ts'
import {choiceFrames} from '../../src/frames/lib/frameChoice.ts'
import {impastoColor, impastoIndex, impastoOrder, impastoPaints} from '../../src/lib/materials/impastoPaints.ts'
import {moods} from '../../src/moods/index.ts'
import ImpastoOrbMaterial from '../../src/orbs/impasto/ImpastoOrbMaterial.ts'
import {impastoRelief} from '../../src/orbs/impasto/reliefTexture.ts'
import {fillIor, groundRadius, impastoSurface, impastoSweeps, reliefLimit} from '../../src/orbs/impasto/strokes.ts'
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
  test('gives every knife stroke a disjoint footprint on the warped chart, even across the longitude seam', () => {
    let lastLatitude = 0
    for (const [south, north, cuts] of impastoSweeps) {
      expect(south).toBeGreaterThan(lastLatitude)
      expect(north).toBeGreaterThan(south)
      expect(north).toBeLessThan(1)
      for (const [index, [start, end]] of cuts.entries()) {
        const nextStart = cuts[index + 1]?.[0] ?? cuts[0][0] + 1
        expect(end).toBeGreaterThan(start)
        expect(end).toBeLessThan(nextStart)
      }
      lastLatitude = north
    }
  })
  test('joins both sides of the atlas and converges to one ground color at each pole', () => {
    const a = new Color
    const b = new Color
    const streak = new Color
    const sameSurface = (u: number, v: number, otherU: number) => {
      expect(impastoSurface(u, v, a, streak)).toBeCloseTo(impastoSurface(otherU, v, b, streak), 9)
      for (const channel of ['r', 'g', 'b'] as const) {
        expect(a[channel]).toBeCloseTo(b[channel], 9)
      }
    }
    for (let index = 0; index <= 160; index++) {
      const fraction = index / 160
      sameSurface(0, fraction, 1)
      sameSurface(0, 0, fraction)
      sameSurface(0, 1, fraction)
    }
  })
  test('shares one relief atlas whose raised strokes stay apart and clear of the glass', () => {
    const relief = impastoRelief()
    expect(impastoRelief()).toBe(relief)
    expect(relief.wrapS).toBe(RepeatWrapping)
    expect(relief.minFilter).toBe(LinearFilter)
    expect(relief.type).toBe(HalfFloatType)
    // The largest possible impact parameter after refraction is 1 / IOR, so some rays can miss the entire painting.
    expect(groundRadius + reliefLimit).toBeLessThan(1 / fillIor)
    const {data, width, height} = relief.image as {
      data: Uint16Array
      height: number
      width: number
    }
    const raised = new Uint8Array(width * height)
    let maxRelief = 0
    let minRelief = 1
    for (let pixel = 0; pixel < raised.length; pixel++) {
      const thickness = DataUtils.fromHalfFloat(data[pixel * 4 + 3])
      maxRelief = Math.max(maxRelief, thickness)
      minRelief = Math.min(minRelief, thickness)
      // Ignore the shallow scumble of the underpainting when identifying the thick knife marks.
      raised[pixel] = Number(thickness * reliefLimit > 0.01)
    }
    expect(minRelief).toBeGreaterThanOrEqual(0)
    expect(maxRelief).toBeLessThan(1)
    expect(maxRelief * reliefLimit).toBeGreaterThan(0.08)
    let islands = 0
    function take(pixel: number, queue: Array<number>) {
      if (raised[pixel]) {
        raised[pixel] = 0
        queue.push(pixel)
      }
    }
    for (const [start, element] of raised.entries()) {
      if (!element) {
        continue
      }
      const queue: Array<number> = []
      take(start, queue)
      for (let index = 0; index < queue.length; index++) {
        const pixel = queue[index]
        const x = pixel % width
        take(x === 0 ? pixel + width - 1 : pixel - 1, queue)
        take(x === width - 1 ? pixel - width + 1 : pixel + 1, queue)
        take(pixel - width, queue)
        take(pixel + width, queue)
      }
      if (queue.length >= 16) {
        islands++
      }
    }
    expect(islands).toBe(impastoSweeps.reduce((count, [, , cuts]) => count + cuts.length, 0))
  })
})
