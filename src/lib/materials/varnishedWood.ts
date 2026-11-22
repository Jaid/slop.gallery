import {surfaceTexture} from '#src/components/Scene/materials.ts'

import WoodFloorMaterial from './WoodFloorMaterial.ts'

/** how far one repeat of the wood’s texture reaches along x and z, as the Vesper’s floor spreads its 3 × 3 repeats over 12 × 24 m */
const woodRepeat = [4, 8] as const
/** The varnish, glossier than the Vesper’s, so its mirror shows the room more sharply. */
const varnish = {
  roughness: 0.15,
  gaussianBlur: 13,
}

/** The Cell’s floor: the Vesper’s varnished wood, mirroring the room through a blur where `reflections` lets it, for a plane whose UVs are world meters, the grain along z; released with its texture. */
export default function createVarnishedWood(anisotropy: number, reflections: boolean) {
  const texture = surfaceTexture('wood', anisotropy)
  texture.repeat.set(1 / woodRepeat[0], 1 / woodRepeat[1])
  const material = new WoodFloorMaterial(texture, reflections, varnish)
  return {
    material,
    dispose() {
      material.dispose()
      texture.dispose()
    },
  }
}
