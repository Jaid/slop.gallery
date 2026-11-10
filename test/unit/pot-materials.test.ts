import {expect, test} from 'bun:test'

import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import decorationResources from '../../src/lib/gallery/plantDecorations/DecorationResources.ts'
import CeladonMaterial from '../../src/lib/materials/CeladonMaterial.ts'
import PorcelainMaterial from '../../src/lib/materials/PorcelainMaterial.ts'
import PotMaterials from '../../src/lib/materials/PotMaterials.ts'
import TenmokuMaterial from '../../src/lib/materials/TenmokuMaterial.ts'
import {getGraphicsProfile} from '../../src/lib/rendering/graphicsMode.ts'

test('fast pots and soil have warm, matte colors without noise maps', () => {
  const materials = new PotMaterials(getGraphicsProfile(false).noiseTextures)
  try {
    const clay = materials.shells.atelier.color
    const soil = materials.soil.color
    for (const {r, g, b} of [clay, soil]) {
      expect(r).toBeGreaterThan(g)
      expect(g).toBeGreaterThan(b)
    }
    expect(soil.r + soil.g + soil.b).toBeLessThan(clay.r + clay.g + clay.b)
    for (const material of [...Object.values(materials.shells), materials.soil]) {
      expect(material.map).toBeNull()
      expect(material.bumpMap).toBeNull()
      expect(material.normalMap).toBeNull()
      expect(material.roughnessMap).toBeNull()
    }
  } finally {
    materials.dispose()
  }
})
test('heavy pots restore clay color, relief and roughness maps and detailed soil', () => {
  const materials = new PotMaterials(getGraphicsProfile(true).noiseTextures)
  try {
    const clay = materials.shells.atelier
    expect(clay.map).not.toBeNull()
    expect(clay.bumpMap).not.toBeNull()
    expect(clay.roughnessMap).not.toBeNull()
    expect(materials.soil.map).not.toBeNull()
    expect(materials.soil.bumpMap).not.toBeNull()
    // Textured colors are not tinted a second time by the fast base color.
    expect(clay.color.getHexString()).toBe('ffffff')
    expect(materials.soil.color.getHexString()).toBe('ffffff')
  } finally {
    materials.dispose()
  }
})
test('switching finishes reuses shared geometry and caches independent material variants', () => {
  const resources = decorationResources()
  const pot = resources.pot('atelier')
  const fast = resources.potMaterials(false)
  const heavy = resources.potMaterials(true)
  expect(fast).not.toBe(heavy)
  expect(resources.potMaterials(false)).toBe(fast)
  expect(resources.potMaterials(true)).toBe(heavy)
  expect(resources.pot('atelier')).toBe(pot)
  expect(fast.soil.map).toBeNull()
  expect(heavy.soil.map).not.toBeNull()
})
test('celadon, ivory and noir keep their glazed physical finishes in every graphics mode', () => {
  for (const noiseTextures of [false, true]) {
    const materials = new PotMaterials(noiseTextures)
    try {
      const {celadon, ivory, noir} = materials.shells
      expect(noir).toBeInstanceOf(TenmokuMaterial)
      expect(noir.clearcoatNode).not.toBeNull()
      expect(noir.iridescenceNode).not.toBeNull()
      expect(celadon).toBeInstanceOf(CeladonMaterial)
      expect(celadon).toBeInstanceOf(MeshPhysicalNodeMaterial)
      expect(celadon.colorNode).not.toBeNull()
      expect(celadon.roughnessNode).not.toBeNull()
      expect(celadon.normalNode).not.toBeNull()
      expect(celadon.clearcoat).toBe(1)
      expect(celadon.metalness).toBe(0)
      expect(ivory).toBeInstanceOf(PorcelainMaterial)
      expect(ivory).toBeInstanceOf(MeshPhysicalNodeMaterial)
      expect(ivory.colorNode).not.toBeNull()
      expect(ivory.normalNode).not.toBeNull()
      expect(ivory.iridescence).toBeGreaterThan(0)
      expect(ivory.iridescenceNode ?? null).toBeNull()
      expect(ivory.iridescenceThicknessNode).not.toBeNull()
      expect(ivory.iridescenceThicknessMinimum).toBeLessThan(ivory.iridescenceThicknessMaximum)
      for (const material of [celadon, ivory, noir]) {
        expect(material.map).toBeNull()
        expect(material.bumpMap).toBeNull()
        expect(material.roughnessMap).toBeNull()
      }
    } finally {
      materials.dispose()
    }
  }
})
test('each finish set releases exactly its own materials and textures', () => {
  for (const noiseTextures of [false, true]) {
    const materials = new PotMaterials(noiseTextures)
    let disposedMaterials = 0
    let disposedTextures = 0
    for (const material of [...Object.values(materials.shells), materials.soil]) {
      material.addEventListener('dispose', () => {
        disposedMaterials++
      })
      for (const texture of [material.map, material.bumpMap, material.roughnessMap]) {
        texture?.addEventListener('dispose', () => {
          disposedTextures++
        })
      }
    }
    materials.dispose()
    expect(disposedMaterials).toBe(5)
    expect(disposedTextures).toBe(noiseTextures ? 5 : 0)
  }
})
