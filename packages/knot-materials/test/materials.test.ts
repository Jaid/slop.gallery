import type {KnotMaterialModule} from '../src/types.ts'
import type {Node} from 'three/webgpu'

import {expect, test} from 'bun:test'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'

import {cameraPosition, positionView, positionViewDirection} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {knots} from '../src/main.ts'
import StudioEnvironment from '../src/StudioEnvironment.ts'

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
test('all material modules construct with caller-owned lighting and valid shading graphs', async () => {
  const environment = new StudioEnvironment
  let disposals = 0
  environment.addEventListener('dispose', () => disposals++)
  try {
    for (const exhibit of knots) {
      const {default: Material} = await import(pathToFileURL(resolve(import.meta.dir, '../src/entries', exhibit.id, 'Material.ts')).href) as KnotMaterialModule
      const material = new Material(environment)
      try {
        expect(material.name).toBe(exhibit.id)
        expect(material.envMap).toBe(environment)
        expect(material).toBeInstanceOf(MeshPhysicalNodeMaterial)
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
    expect(disposals).toBe(0)
  } finally {
    environment.dispose()
  }
  expect(disposals).toBe(1)
}, 30_000)
