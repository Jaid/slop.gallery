import type {Node, NodeFrame, Renderer, TextureNode} from 'three/webgpu'

import {float, Fn, instanceIndex, mix, mx_cell_noise_vec3, nodeObject, textureStore, uvec3, vec3, vec4} from 'three/tsl'
import {HalfFloatType, NodeUpdateType, RepeatWrapping, Storage3DTexture, Texture3DNode} from 'three/webgpu'

/** texels along each edge of the noise tile */
const size = 64
/** lattice cells along each edge of the noise tile, after which the noise repeats */
const period = 8
/** Three’s MaterialX Perlin noise uses gradients of length √2 and scales its result by 0.982; unit gradients times this give the same range. */
const amplitude = Math.SQRT2 * 0.982
/** Perlin noise that repeats every {@link period} lattice cells along each axis, so the baked tile wraps without a seam. `seed` picks one of independent noises. */
function periodicPerlin(point: Node<'vec3'>, seed: number) {
  const cell = point.floor()
  const offset = point.sub(cell)
  const fade = offset.mul(offset).mul(offset).mul(offset.mul(offset.mul(6).sub(15)).add(10))
  const corner = (x: number, y: number, z: number) => {
    const lattice = cell.add(vec3(x, y, z)).mod(period)
    const gradient = mx_cell_noise_vec3(lattice.add(seed * 64)).mul(2).sub(1).normalize()
    return gradient.dot(offset.sub(vec3(x, y, z)))
  }
  const x0 = mix(mix(corner(0, 0, 0), corner(1, 0, 0), fade.x), mix(corner(0, 1, 0), corner(1, 1, 0), fade.x), fade.y)
  const x1 = mix(mix(corner(0, 0, 1), corner(1, 0, 1), fade.x), mix(corner(0, 1, 1), corner(1, 1, 1), fade.x), fade.y)
  return mix(x0, x1, fade.z).mul(amplitude)
}
const tile = new Storage3DTexture(size, size, size)
tile.name = 'orb-noise'
tile.type = HalfFloatType
tile.wrapS = RepeatWrapping
tile.wrapT = RepeatWrapping
tile.wrapR = RepeatWrapping
/** Fills the tile with four independent noises, one per channel, each sampled at the texel centers. */
const bake = Fn(() => {
  const x = instanceIndex.mod(size)
  const y = instanceIndex.div(size).mod(size)
  const z = instanceIndex.div(size * size)
  const point = vec3(x, y, z).add(0.5).mul(period / size)
  textureStore(tile, uvec3(x, y, z), vec4(periodicPerlin(point, 0), periodicPerlin(point, 1), periodicPerlin(point, 2), periodicPerlin(point, 3))).toWriteOnly()
})().compute(size ** 3)
/** Every renderer has its own device and copy of the tile, which it bakes the first time it draws an orb. */
const baked = new WeakSet<Renderer>
/**
 * Four independent Perlin noises at a point, each about −1–1 and in the same units and range as Three’s `mx_noise_float`, read from a baked tile.
 * A texture lookup is much cheaper than evaluating the noise, which matters in the fills, which sample it many times per pixel. It repeats every 8 units.
 */
export function orbNoise(point: Node<'vec3'>) {
  // Its only level, read explicitly: the fills sample it in loops that end early, at depths jittered per pixel, where the screen derivatives a sampler would pick a level by are meaningless and tile the result into blocks.
  return nodeObject(new OrbNoiseNode(tile, point.div(period), float(0))) as unknown as TextureNode & Node<'vec4'>
}

/** Fractal noise like Three’s `mx_fractal_noise_float`, each octave read from another channel and place of the tile so their repetitions don’t line up. */
export function orbFractalNoise(point: Node<'vec3'>, octaves: number, lacunarity = 2, diminish = 0.5) {
  let sum: Node<'float'> = float(0)
  for (let octave = 0; octave < octaves; octave++) {
    const sample = orbNoise(point.mul(lacunarity ** octave).add(octave * 2.37))
    sum = sum.add([sample.x, sample.y, sample.z, sample.w][octave % 4].mul(diminish ** octave))
  }
  return sum
}

/** A lookup into the noise tile that bakes it first if this renderer hasn’t yet. */
class OrbNoiseNode extends Texture3DNode {
  constructor(value = tile, uvNode: Node | null = null, levelNode: Node | null = null) {
    super(value, uvNode, levelNode)
    this.updateBeforeType = NodeUpdateType.FRAME
  }

  override updateBefore({renderer}: NodeFrame): undefined {
    if (renderer && !baked.has(renderer)) {
      baked.add(renderer)
      // A renderer that draws is initialized, so the dispatch is queued right away, ahead of the draw; only an uninitialized one would return a promise.
      renderer.compute(bake)?.catch((error: unknown) => console.error('The orb noise could not be baked.', error))
    }
  }
}
