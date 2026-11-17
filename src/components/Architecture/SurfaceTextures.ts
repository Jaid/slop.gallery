import type {Texture} from 'three/webgpu'

import {surfaceTexture} from '#src/components/Scene/materials.ts'
import MadeOnDemand from '#src/lib/materials/base/MadeOnDemand.ts'

/** The plaster, stone and wood textures the gallery’s walls and rooms share, filtered at `anisotropy`: each is made the first time a wall or a room asks for it, so the rooms out of the world’s reach never make theirs. */
export default class SurfaceTextures extends MadeOnDemand {
  constructor(private readonly anisotropy: number) {
    super()
  }

  get plaster(): Texture {
    return this.once('plaster', () => surfaceTexture('plaster', this.anisotropy))
  }

  get stone(): Texture {
    return this.once('stone', () => surfaceTexture('stone', this.anisotropy))
  }

  get wood(): Texture {
    return this.once('wood', () => surfaceTexture('wood', this.anisotropy))
  }
}
