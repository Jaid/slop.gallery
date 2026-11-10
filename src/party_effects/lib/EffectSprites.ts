import type {PlaneGeometry} from 'three/webgpu'

import {uniform} from 'three/tsl'
import {DoubleSide, InstancedBufferAttribute, InstancedMesh, MeshBasicNodeMaterial, Vector3} from 'three/webgpu'

import TransparentSpriteOutputsNode from '#src/lib/rendering/TransparentSpriteOutputsNode.ts'

export type EffectSpritesOptions = {
  /** whether the tone mapping takes their colors in like a lit surface’s, for something solid like flesh; off by default, so they keep their colors in a dark room */
  toneMapped?: boolean
}

/** Sets an attribute on the geometry that holds a vector of `rows`’ length for every instance, one row each. */
export function instanceAttribute(geometry: PlaneGeometry, name: string, rows: ReadonlyArray<ReadonlyArray<number>>) {
  const size = rows[0]?.length ?? 1
  const values = new Float32Array(rows.length * size)
  for (const [index, row] of rows.entries()) {
    values.set(row, index * size)
  }
  geometry.setAttribute(name, new InstancedBufferAttribute(values, size))
}

/**
 * Quads an effect draws around the point it bursts out of in one instanced draw, soft and depth-less like the sprites of a fusion’s portal, untouched by the tone mapping unless they ask for it, so they keep their colors in a dark room: their color blends normally, while the geometry buffers keep the scene behind them (`TransparentSpriteOutputsNode`). The vertex shader lays every one out and animates it by the clock, the seconds since it burst out, so the source quad’s bounds say nothing and they are never culled.
 * Positions are relative to that point, its origin, which the mesh stands at.
 */
export default class EffectSprites extends InstancedMesh<PlaneGeometry, MeshBasicNodeMaterial> {
  readonly uniforms = {
    /** seconds since it burst out; before that, none shows */
    clock: uniform(-1),
    /** the floor’s height below its origin, as a negative offset in meters */
    floor: uniform(-1.8),
    /** level, the way it faces: out of the wall behind it, if there is one, toward the room */
    normal: uniform(new Vector3(0, 0, 1)),
    /** level, along that wall, to the right of someone facing it */
    tangent: uniform(new Vector3(1, 0, 0)),
  }

  constructor(name: string, geometry: PlaneGeometry, count: number, {toneMapped = false}: EffectSpritesOptions = {}) {
    const material = new MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      toneMapped,
      side: DoubleSide,
    })
    material.name = name
    material.mrtNode = new TransparentSpriteOutputsNode
    super(geometry, material, count)
    this.name = name
    this.frustumCulled = false
  }

  override dispose() {
    this.geometry.dispose()
    this.material.dispose()
    super.dispose()
  }
}
