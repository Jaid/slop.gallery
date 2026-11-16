import {describe, expect, test} from 'bun:test'

import {Vector3} from 'three/webgpu'

import {transmutedOrb} from '../../src/lib/gallery/alchemy/flavor.ts'
import FusionRecipe, {itemIngredient, portraitIngredient} from '../../src/lib/gallery/fusion/FusionRecipe.ts'
import {vesperOrbs} from '../../src/lib/gallery/vesperOrbs.ts'
import {moods} from '../../src/moods/index.ts'
import ImpastoOrbMaterial from '../../src/orbs/impasto/ImpastoOrbMaterial.ts'
import {impastoPalette, impastoStrokes} from '../../src/orbs/impasto/strokes.ts'
import {impastoOrb, orbRadius, orbs, paintOrb, promptOrbs, randomOrbs, transparentOrb} from '../../src/orbs/index.ts'
import Sandbox from '../../src/worlds/sandbox/Sandbox.ts'

const source = new Blob(['original artwork'], {type: 'image/png'})
const recipe = () => new FusionRecipe([
  portraitIngredient({
    title: 'Original',
    source,
  }),
  itemIngredient(impastoOrb.title, impastoOrb.ingredient(7)),
])
describe('Impasto Orb', () => {
  test('is a distinct, obtainable orb with the usual prop identity, not a replacement for the Paint Orb', () => {
    expect(impastoOrb.id).toBe('impasto')
    expect(impastoOrb.title).toBe('Impasto Orb')
    expect(impastoOrb.propId).toBe('prop-orb-impasto')
    expect(orbs).toContain(impastoOrb)
    expect(promptOrbs).toContain(impastoOrb)
    expect(randomOrbs).toContain(impastoOrb)
    expect(orbs).toContain(paintOrb)
    expect(impastoOrb).not.toBe(paintOrb)
    expect(Array.from({length: 64}, (_, seed) => vesperOrbs(seed)).flat().some(({orb}) => orb === impastoOrb)).toBe(true)
    const sandbox = new Sandbox([impastoOrb.propId, impastoOrb.propId])
    expect(sandbox.items.map(item => item.id)).toEqual(['prop-orb-impasto', 'prop-orb-impasto-2'])
    expect(sandbox.items.every(item => item.orb === impastoOrb)).toBe(true)
  })
  test('always requests every quality and digital impasto, explicitly preserving the original content', () => {
    const prompt = impastoOrb.prompt(0)
    expect(prompt).toBe('This picture is being repainted in digital impasto, not reimagined as a different scene.\n\nPlease edit this image and restyle it as a digital impasto artwork while keeping the original content intact. Preserve the subjects, composition and recognizable details; change only the painting technique. Use thick palette-knife strokes, raised paint ridges and sculptural highlights. The result should be high-quality, detailed, cohesive, atmospheric, tactile and bold.')
    for (const seed of [1, 7, 1234, 0xFF_FF_FF_FF]) {
      expect(impastoOrb.prompt(seed)).toBe(prompt)
    }
    expect(impastoOrb.prompt(7)).not.toBe(paintOrb.prompt(7))
  })
  test('edits only the target image, not a collage with the orb’s photograph', async () => {
    const fusion = recipe()
    expect(fusion.unchanged).toBe(false)
    expect(fusion.imageCount).toBe(1)
    expect(await fusion.images()).toEqual([source])
    expect(fusion.text(1)).toBe(impastoOrb.prompt(7))
    expect(fusion.looks).toEqual([source, impastoOrb.photo])
    expect(fusion.glow).toBe(impastoOrb.color)
    expect(fusion.frame).toBe('canvas')
    expect(fusion.effects).toEqual(['strokes'])
    expect(fusion.latches).toEqual(['charge', 'glass'])
  })
  test('uses its atelier mood, clear-glass remains and honest no-AI tint fallback', () => {
    expect(moods[impastoOrb.mood].title).toBe('Impasto atelier')
    expect(impastoOrb.remains).toBe(transparentOrb)
    expect(recipe().handmade).toBe('tint')
    expect(recipe().localDescription).toBe('Tinted by hand in the Impasto Orb’s glow.')
    expect(recipe().tints.map(tint => tint.glow)).toEqual([impastoOrb.color])
    expect(transmutedOrb(impastoOrb, [], () => 'forge', 0.5)).toBe(impastoOrb)
  })
  test('creates a dedicated glass material per instance, opaque to depth despite its transmission', () => {
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
  test('keeps every stroke’s padded marching box inside the glass, with orthonormal axes and valid pigments', () => {
    expect(impastoStrokes.length).toBeGreaterThan(12)
    for (const {center, along, across, normal, radii, pigment} of impastoStrokes) {
      for (const axis of [along, across, normal]) {
        expect(axis.length()).toBeCloseTo(1, 9)
      }
      expect(along.dot(across)).toBeCloseTo(0, 9)
      expect(along.dot(normal)).toBeCloseTo(0, 9)
      expect(across.dot(normal)).toBeCloseTo(0, 9)
      expect(pigment).toBeGreaterThanOrEqual(0)
      expect(pigment).toBeLessThan(impastoPalette.length)
      for (const x of [-1.1, 1.1]) {
        for (const y of [-1.1, 1.1]) {
          for (const z of [-1.1, 1.1]) {
            const corner = new Vector3
            corner.copy(center).addScaledVector(along, x * radii[0]).addScaledVector(across, y * radii[1]).addScaledVector(normal, z * radii[2])
            expect(corner.length()).toBeLessThan(0.95)
          }
        }
      }
    }
  })
})
