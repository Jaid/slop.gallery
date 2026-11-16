import type KnotMaterial from 'knot-materials/lib/KnotMaterial.ts'
import type {Node} from 'three/webgpu'

import {describe, expect, test} from 'bun:test'
import {resolve} from 'node:path'

import {knots, knotsById} from 'knot-materials'
import {knotBays, knotExhibition, knotFloatHeight, knotPreviewX, knotRowHalfWidth, knotSpacing} from 'knot-materials/exhibition.ts'
import {createKnotGeometry, knotGeometryArgs} from 'knot-materials/geometry.ts'
import StudioEnvironment from 'knot-materials/StudioEnvironment.ts'
import {cameraPosition, positionView, positionViewDirection} from 'three/tsl'
import {EquirectangularReflectionMapping, FloatType} from 'three/webgpu'

import {insideKnotGallery, knotGalleryBounds} from '../../src/lib/gallery/knotGallery.ts'
import knottingham from '../../src/worlds/knottingham/index.ts'
import {knotRarityEditor} from '../../src/worlds/knottingham/rarity.ts'

const dumpKnots = () => knottingham.dumpKnots()
// Known offenders that still displace from cached view-space varyings. Do not add to this list.
const viewDependentRelief = new Set([
  'abyssal_veil',
  'asteria',
  'bismuth_labyrinth',
  'celadon_kintsugi',
  'chladni_resonance',
  'ferrofluid_oracle',
  'golden_mend',
  'gossamer',
  'jovian_vortex',
  'kairothic_frost',
  'kintsugi_nebula',
  'lichen_cathedral',
  'mercury_sea',
  'mercury_swell',
  'mercury_tremor',
  'midnight_velvet',
  'moire_satin',
  'moonstone_dune',
  'murmuration_silk',
  'mycelial_bloom',
  'mycelial_lumen',
  'oceanic_nacre',
  'planck_boil',
  'quicksilver',
  'singing_sand',
  'stained_afternoon',
  'sumi_tide',
  'tidal_glass',
  'tourmaline_nebula',
  'velvet_penumbra',
  'vermillion_lacquer',
  'vitrail',
])
// Shared shader subgraphs are a DAG, not a tree. Visit each node only once.
const collectNodes = (roots: Array<Node>) => {
  const nodes = new Set(roots)
  const queue = [...nodes]
  for (let cursor = 0; cursor < queue.length; cursor++) {
    for (const child of queue[cursor].getChildren()) {
      if (nodes.has(child)) {
        continue
      }
      nodes.add(child)
      queue.push(child)
    }
  }
  return nodes
}
describe('multi-model Knot challenge', () => {
  test('enumerates displayed Knots at initialization while keeping stable identities', () => {
    const displayedByCandidate = Map.groupBy(knots, item => item.candidate.id)
    expect(knotBays).toHaveLength(8)
    expect(knotBays.every(bay => bay.finishes.length === 4)).toBe(true)
    const expectedCount = 32
    expect(knotExhibition).toHaveLength(expectedCount)
    const exhibitIds = new Set(knotExhibition.map(item => item.id))
    expect(exhibitIds.size).toBe(expectedCount)
    expect(knotBays.every(bay => displayedByCandidate.has(bay.candidate.id))).toBe(true)
    expect(knotExhibition.map(item => item.number)).toEqual(Array.from({length: expectedCount}, (_, index) => index + 1))
    for (const bay of knotBays) {
      expect(bay.finishes.map(item => item.rarity)).toEqual(bay.finishes.map(item => item.rarity).toSorted((a, b) => a - b))
    }
    for (const item of knotExhibition) {
      expect(knotsById.get(item.id)?.id).toBe(item.id)
      expect(item.id).toMatch(/^[a-z][0-9_a-z]*$/u)
      expect(item.candidate.id).toBe(item.candidateId)
    }
  })
  test('dumps the current world selection and live session rarities', () => {
    const before = dumpKnots()
    expect(before).toHaveLength(knotExhibition.length)
    for (const [index, exhibit] of knotExhibition.entries()) {
      expect(before[index]).toEqual({
        id: exhibit.id,
        name: exhibit.title,
        position: [exhibit.position[0], knotFloatHeight, exhibit.position[2]],
        rarity: exhibit.rarity,
      })
    }
    const exhibit = knotExhibition[0]
    const baseline = exhibit.rarity
    const edited = knotRarityEditor.cycle(exhibit.id)
    try {
      expect(dumpKnots().find(item => item.id === exhibit.id)?.rarity).toBe(edited)
    } finally {
      // The cycle covers all six tiers: unknown, common, rare, prime, ethereal and special.
      for (let count = 0; count < 5; count++) {
        knotRarityEditor.cycle(exhibit.id)
      }
      expect(knotRarityEditor.getSnapshot().get(exhibit.id)).toBe(baseline)
    }
  })
  test('keeps every floating Knot inside the expanded lobby with walking clearance', () => {
    for (const [index, exhibit] of knotExhibition.entries()) {
      const [x, , z] = exhibit.position
      expect(insideKnotGallery([x, 0.04, z])).toBe(true)
      expect(x - 0.58).toBeGreaterThan(knotGalleryBounds.minX + 1)
      expect(x + 0.58).toBeLessThan(knotGalleryBounds.maxX - 1)
      expect(z - 0.58).toBeGreaterThan(knotGalleryBounds.northZ + 1)
      expect(z + 0.58).toBeLessThan(knotGalleryBounds.southZ - 1)
      const bay = knotBays.find(knotBay => knotBay.candidate.id === exhibit.candidate.id)!
      expect(z).toBe(bay.center[2])
      expect(exhibit.rotation).toBe(0)
      expect(exhibit.label).toBe(`#${String(exhibit.number).padStart(2, '0')}`)
      expect(exhibit.modelTitle).toBe(exhibit.author.model.title)
      for (const other of knotExhibition.slice(index + 1)) {
        expect(Math.hypot(x - other.position[0], z - other.position[2])).toBeGreaterThan(3)
      }
    }
  })
  test('floats at crouching eye height in one row per candidate', () => {
    expect(knotFloatHeight).toBe(1)
    for (const bay of knotBays) {
      const row = knotExhibition.filter(exhibit => exhibit.candidate.id === bay.candidate.id)
      const rowDepths = new Set(row.map(exhibit => exhibit.position[2]))
      expect(rowDepths.size).toBe(1)
      for (let i = 1; i < row.length; i++) {
        expect(row[i].position[0] - row[i - 1].position[0]).toBe(knotSpacing)
      }
    }
  })
  test('aligns every row to the summary-board side', () => {
    expect(knotPreviewX).not.toBeNull()
    for (const bay of knotBays) {
      const row = knotExhibition.filter(exhibit => exhibit.candidate.id === bay.candidate.id)
      expect(row[0].position[0]).toBe(-knotRowHalfWidth)
      expect(row[0].position[0] - knotPreviewX!).toBeGreaterThan(knotSpacing)
      for (const [index, exhibit] of row.entries()) {
        expect(exhibit.position[0]).toBe(-knotRowHalfWidth + index * knotSpacing)
      }
    }
  })
  test('all bay approaches are safe navigation and spawn targets', () => {
    for (const bay of knotBays) {
      const position: [number, number, number] = [-knotRowHalfWidth, 0.04, bay.center[2] + 2.5]
      expect(insideKnotGallery(position)).toBe(true)
      for (const exhibit of knotExhibition) {
        expect(Math.hypot(position[0] - exhibit.position[0], position[2] - exhibit.position[2])).toBeGreaterThan(1.5)
      }
    }
  })
  test('all item modules construct independently while sharing caller-owned lighting', async () => {
    const environment = new StudioEnvironment
    let disposed = false
    environment.addEventListener('dispose', () => disposed = true)
    try {
      for (const exhibit of knots) {
        const {default: Material} = await import(resolve(import.meta.dir, '../../packages/knot-materials/src/entries', exhibit.id, 'Material.ts')) as {default: new(environment: StudioEnvironment) => KnotMaterial}
        const material = new Material(environment)
        try {
          expect(material.name).toBe(exhibit.id)
          expect(material.envMap).toBe(environment)
          expect(material.isMeshPhysicalNodeMaterial).toBe(true)
          expect(material.map).toBeNull()
          if (material.opacityNode) {
            if (material.alphaTest > 0) {
              expect(material.transparent, exhibit.id).toBe(false)
              expect(material.alphaToCoverage, exhibit.id).toBe(true)
            } else {
              expect(material.transparent, exhibit.id).toBe(true)
            }
            expect(material.depthWrite, exhibit.id).toBe(true)
            expect(material.alphaHash, exhibit.id).toBe(false)
          }
          if (exhibit.displacement) {
            expect(material.positionNode, exhibit.id).not.toBeNull()
            expect(material.normalNode, exhibit.id).not.toBeNull()
            // Reading these output varyings before displacement caches an undeformed clip position.
            const vertexDependencies = collectNodes([material.positionNode!])
            expect(vertexDependencies.has(positionView) || vertexDependencies.has(positionViewDirection), exhibit.id).toBe(viewDependentRelief.has(exhibit.id))
          } else {
            expect(material.positionNode, exhibit.id).toBeNull()
          }
          const dependencies = collectNodes(Object.values(material).filter((value: unknown): value is Node => Boolean(value && typeof value === 'object' && 'isNode' in value && value.isNode)))
          // Camera response may use proximity or the built-in, lazily evaluated view direction.
          expect(dependencies.has(positionView) || dependencies.has(cameraPosition) || dependencies.has(positionViewDirection), exhibit.id).toBe(true)
          // Some submissions express the angular response only through physical Fresnel
          // or view normals, so do not demand object-local cameraPosition from all models.
          if (exhibit.id === 'lenticular_mirage') {
            expect(dependencies.has(cameraPosition), exhibit.id).toBe(true)
          }
        } finally {
          material.dispose()
        }
      }
      expect(disposed).toBe(false)
    } finally {
      environment.dispose()
    }
    expect(disposed).toBe(true)
  }, 30_000)
  test('provides orthonormal tangents with continuous UV seams for close-up anisotropic shading', () => {
    const geometry = createKnotGeometry()
    try {
      const tangent = geometry.getAttribute('tangent')
      const normal = geometry.getAttribute('normal')
      expect(tangent.count).toBe(normal.count)
      for (let i = 0; i < tangent.count; i++) {
        const x = tangent.getX(i)
        const y = tangent.getY(i)
        const z = tangent.getZ(i)
        if (Math.abs(Math.hypot(x, y, z) - 1) > 1e-6 || Math.abs(x * normal.getX(i) + y * normal.getY(i) + z * normal.getZ(i)) > 1e-6 || Math.abs(tangent.getW(i)) !== 1) {
          throw new Error('Invalid Knot tangent frame.')
        }
      }
      const equal = (a: number, b: number) => {
        expect([tangent.getX(a), tangent.getY(a), tangent.getZ(a), tangent.getW(a)])
          .toEqual([tangent.getX(b), tangent.getY(b), tangent.getZ(b), tangent.getW(b)])
      }
      const [, , tubular, radial] = knotGeometryArgs
      for (let v = 0; v <= radial; v++) {
        equal(v, tubular * (radial + 1) + v)
      }
      for (let u = 0; u <= tubular; u++) {
        equal(u * (radial + 1), u * (radial + 1) + radial)
      }
    } finally {
      geometry.dispose()
    }
  })
  test('generates deterministic, finite high-dynamic-range radiance without files', () => {
    const a = new StudioEnvironment
    const b = new StudioEnvironment
    try {
      expect(a.mapping).toBe(EquirectangularReflectionMapping)
      expect(a.type).toBe(FloatType)
      expect(a.image.data).not.toBe(b.image.data)
      expect(a.image.data).toEqual(b.image.data)
      let maximum = 0
      const pixels = a.image.data!
      for (let i = 0; i < pixels.length; i += 4) {
        for (let channel = 0; channel < 3; channel++) {
          const value = pixels[i + channel]
          if (!Number.isFinite(value) || value < 0) {
            throw new Error('Invalid studio radiance.')
          }
          maximum = Math.max(maximum, value)
        }
        if (pixels[i + 3] !== 1) {
          throw new Error('Invalid studio alpha.')
        }
      }
      expect(maximum).toBeGreaterThan(3)
      expect(maximum).toBeLessThan(5)
      for (let i = 0; i < pixels.length; i += 4) {
        if (Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) < 0.1) {
          throw new Error('Studio fill should not leave metallic surfaces nearly black.')
        }
      }
      // Adjacent texel centers straddle a smooth periodic lighting field at the seam.
      for (let y = 0; y < a.image.height; y++) {
        const first = y * a.image.width * 4
        const last = first + (a.image.width - 1) * 4
        expect(Math.abs(pixels[first] - pixels[last])).toBeLessThan(0.01)
      }
    } finally {
      a.dispose()
      b.dispose()
    }
  })
})
