import {expect, spyOn, test} from 'bun:test'

import {MeshStandardNodeMaterial} from 'three/webgpu'

import {lodgeWindow} from '../../src/lib/gallery/lodge.ts'
import LodgeWindowGeometry from '../../src/lib/gallery/LodgeWindowGeometry.ts'
import {createArchitecturalGlassMaterials, disposeArchitecturalGlassMaterials} from '../../src/lib/materials/ArchitecturalGlassMaterials.ts'
import CastFloorGlassMaterial from '../../src/lib/materials/CastFloorGlassMaterial.ts'
import ClearGlassMaterial from '../../src/lib/materials/ClearGlassMaterial.ts'
import CrownGlassMaterial from '../../src/lib/materials/CrownGlassMaterial.ts'

test('fast glass shares one plain pane between lobby and cabin and gives the tunnel its own', () => {
  const materials = createArchitecturalGlassMaterials(false)
  expect(materials.lobby).toBe(materials.cabin)
  expect(materials.lobby).toBeInstanceOf(MeshStandardNodeMaterial)
  const material = materials.lobby as MeshStandardNodeMaterial
  expect(material.transparent).toBe(true)
  expect(material.depthWrite).toBe(false)
  expect(material.envMapIntensity).toBe(0)
  const tunnel = materials.tunnel as MeshStandardNodeMaterial
  expect(tunnel).not.toBe(material)
  expect(tunnel.transparent).toBe(true)
  expect(tunnel.opacity).toBeGreaterThan(0)
  expect(tunnel.opacity).toBeLessThan(0.5)
  const disposals = [material, tunnel].map(entry => spyOn(entry, 'dispose'))
  disposeArchitecturalGlassMaterials(materials)
  for (const dispose of disposals) {
    expect(dispose).toHaveBeenCalledTimes(1)
  }
})
test('heavy floor glass refracts the room below through cast pavers', () => {
  const materials = createArchitecturalGlassMaterials(true)
  const lobby = materials.lobby as CastFloorGlassMaterial
  expect(lobby).toBeInstanceOf(CastFloorGlassMaterial)
  expect(lobby.name).toBe('lobby-glass-heavy')
  // The view through the floor is refracted by the material itself, after every opaque surface below has been drawn.
  expect(lobby.transparent).toBe(true)
  expect(lobby.transmission).toBe(0)
  expect(lobby.emissiveNode).not.toBeNull()
  expect(lobby.normalNode).not.toBeNull()
  disposeArchitecturalGlassMaterials(materials)
})
test('heavy tunnel glass blends over the untouched backdrop so the view stays sharp', () => {
  const materials = createArchitecturalGlassMaterials(true)
  const tunnel = materials.tunnel as ClearGlassMaterial
  expect(tunnel).toBeInstanceOf(ClearGlassMaterial)
  expect(tunnel).not.toBeInstanceOf(CrownGlassMaterial)
  expect(tunnel.name).toBe('tunnel-glass-heavy')
  // Physical transmission would resample the backdrop through a smoothing filter.
  expect(tunnel.transmission).toBe(0)
  expect(tunnel.transparent).toBe(true)
  expect(tunnel.depthWrite).toBe(false)
  expect(tunnel.roughness).toBe(0)
  expect(tunnel.color.getHex()).toBe(0)
  expect(tunnel.opacityNode).not.toBeNull()
  expect(tunnel.emissiveNode).toBeNull()
  expect(tunnel.iridescence).toBeGreaterThan(0)
  disposeArchitecturalGlassMaterials(materials)
})
test('heavy cabin glass shows its surface through ripples, haze, smudges and grime instead of reading as an empty opening', () => {
  const materials = createArchitecturalGlassMaterials(true)
  const cabin = materials.cabin as CrownGlassMaterial
  expect(cabin).toBeInstanceOf(CrownGlassMaterial)
  expect(cabin).not.toBe(materials.tunnel)
  expect(cabin.name).toBe('cabin-glass-heavy')
  // The material bends the frame copy itself instead of using the blurring physical transmission.
  expect(cabin.transmission).toBe(0)
  expect(cabin.transparent).toBe(true)
  expect(cabin.depthWrite).toBe(false)
  expect(cabin.clearcoat).toBeGreaterThan(0)
  for (const node of [cabin.normalNode, cabin.colorNode, cabin.roughnessNode, cabin.clearcoatRoughnessNode, cabin.emissiveNode, cabin.opacityNode]) {
    expect(node).not.toBeNull()
  }
  const disposals = Object.values(materials).map(material => spyOn(material, 'dispose'))
  disposeArchitecturalGlassMaterials(materials)
  for (const dispose of disposals) {
    expect(dispose).toHaveBeenCalledTimes(1)
  }
})
test('the lodge pane’s UVs span its face exactly, so the cabin glass measures grime and ripples in meters', () => {
  const geometry = new LodgeWindowGeometry
  const {uv, normal} = geometry.glass.attributes
  // The pane faces the tunnel and the room along x; its UVs run along its width and height.
  for (let index = 0; index < uv.count; index++) {
    if (!(Math.abs(normal.getX(index)) === 1)) {
      continue
    }
    expect([0, 1]).toContain(uv.getX(index))
    expect([0, 1]).toContain(uv.getY(index))
  }
  const {width, height, depth} = geometry.glass.parameters
  expect([depth, height]).toEqual([lodgeWindow.width, lodgeWindow.top - lodgeWindow.bottom])
  expect(width).toBe(lodgeWindow.glassThickness)
  geometry.dispose()
})
