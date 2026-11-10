import type FloorMaterial from '../../src/lib/materials/FloorMaterial.ts'

import {expect, test} from 'bun:test'

import {PerspectiveCamera, Texture} from 'three/webgpu'

import ArchitecturalPlasterMaterial from '../../src/lib/materials/ArchitecturalPlasterMaterial.ts'
import {CheckeredMarbleFloorMaterial} from '../../src/lib/materials/marble/index.ts'
import PlankFloorMaterial, {siennaFloorPlanks} from '../../src/lib/materials/PlankFloorMaterial.ts'
import SlateFloorMaterial from '../../src/lib/materials/SlateFloorMaterial.ts'
import TerrazzoFloorMaterial, {venetianTerrazzo} from '../../src/lib/materials/TerrazzoFloorMaterial.ts'
import {TravertineFloorMaterial} from '../../src/lib/materials/travertine/index.ts'
import WoodFloorMaterial from '../../src/lib/materials/WoodFloorMaterial.ts'
import {getGraphicsProfile} from '../../src/lib/rendering/graphicsMode.ts'

/** every kind of floor, procedural but for the wood, which takes a texture */
const floors: Array<[string, (reflections: boolean) => FloorMaterial]> = [
  ['plank', reflections => new PlankFloorMaterial(siennaFloorPlanks, reflections)],
  ['checkered marble', reflections => new CheckeredMarbleFloorMaterial({
    origin: [0, 0],
    tile: 1,
    reflections,
  })],
  ['travertine', reflections => new TravertineFloorMaterial({
    origin: [0, 0],
    tile: 1,
    reflections,
  })],
  ['terrazzo', reflections => new TerrazzoFloorMaterial({
    center: [0, 0],
    size: [8, 8],
    field: venetianTerrazzo,
    reflections,
  })],
  ['slate', reflections => new SlateFloorMaterial({
    craterRadius: 3,
    reflections,
  })],
]
for (const [kind, create] of floors) {
  test(`${kind} floors shade themselves and mirror the room in heavy only, through the one filtered, nonrecursive reflection all floors share until the last lets go of it`, () => {
    const heavy = create(true)
    const other = create(true)
    const fast = create(false)
    let released = 0
    try {
      expect(heavy.reflection!.reflector.bounces).toBe(false)
      expect(heavy.reflection!.reflector.generateMipmaps).toBe(true)
      expect(heavy.outputNode).not.toBeNull()
      expect(other.reflection).toBe(heavy.reflection)
      expect(fast.reflection).toBeNull()
      expect(fast.outputNode).toBeNull()
      for (const material of [heavy, fast]) {
        expect(material.map).toBeNull()
        expect(material.colorNode).not.toBeNull()
        expect(material.roughnessNode).not.toBeNull()
        expect(material.metalness).toBe(0)
      }
      const target = heavy.reflection!.reflector.getRenderTarget(new PerspectiveCamera)
      target.addEventListener('dispose', () => released++)
      heavy.dispose()
      expect(released).toBe(0)
    } finally {
      for (const material of [heavy, other, fast]) {
        material.dispose()
      }
    }
    expect(released).toBe(1)
  })
}
test('wood floors keep their texture in both modes, varnished in heavy and matte in fast', () => {
  const texture = new Texture
  const heavy = new WoodFloorMaterial(texture, getGraphicsProfile(true).floorReflections)
  const fast = new WoodFloorMaterial(texture, getGraphicsProfile(false).floorReflections)
  try {
    expect(heavy.map).toBe(texture)
    expect(heavy.reflection!.reflector.bounces).toBe(false)
    expect(heavy.outputNode).not.toBeNull()
    expect(fast.map).toBe(texture)
    expect(fast.reflection).toBeNull()
    expect(fast.roughness).toBeGreaterThan(heavy.roughness)
  } finally {
    heavy.dispose()
    fast.dispose()
    texture.dispose()
  }
})
test('wood floors release reflection targets while preserving caller-owned maps', () => {
  const texture = new Texture
  const material = new WoodFloorMaterial(texture)
  const target = material.reflection!.reflector.getRenderTarget(new PerspectiveCamera)
  const disposed: Array<string> = []
  target.addEventListener('dispose', () => disposed.push('reflection'))
  material.addEventListener('dispose', () => disposed.push('material'))
  texture.addEventListener('dispose', () => disposed.push('tile'))
  material.dispose()
  expect(disposed).toEqual(['reflection', 'material'])
  texture.dispose()
  expect(disposed).toEqual(['reflection', 'material', 'tile'])
})
test('wood floors can repeatedly switch without sharing disposed reflection resources', () => {
  const texture = new Texture
  const first = new WoodFloorMaterial(texture, true)
  const reflection = first.reflection
  first.dispose()
  const fast = new WoodFloorMaterial(texture, false)
  expect(fast.reflection).toBeNull()
  fast.dispose()
  const next = new WoodFloorMaterial(texture, true)
  expect(next.reflection).not.toBe(reflection)
  expect(next.map).toBe(texture)
  next.dispose()
  texture.dispose()
})
test('architectural plaster adds procedural color, roughness and relief only in heavy', () => {
  const texture = new Texture
  const heavy = new ArchitecturalPlasterMaterial({
    baseColor: '#658578',
    map: texture,
    heavy: true,
    roughness: 0.9,
  })
  const fast = new ArchitecturalPlasterMaterial({
    baseColor: '#658578',
    map: texture,
    heavy: false,
    roughness: 0.9,
  })
  try {
    expect(heavy.map).toBeNull()
    expect(heavy.colorNode).not.toBeNull()
    expect(heavy.roughnessNode).not.toBeNull()
    expect(heavy.normalNode).not.toBeNull()
    expect(fast.map).toBe(texture)
    expect(fast.colorNode).toBeNull()
    expect(fast.roughnessNode).toBeNull()
    expect(fast.normalNode).toBeNull()
  } finally {
    heavy.dispose()
    fast.dispose()
    texture.dispose()
  }
})
