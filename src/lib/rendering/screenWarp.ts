import type {Camera, Node} from 'three/webgpu'

import {abs, exp, float, fract, max, rotate, screenUV, select, uniform, vec2} from 'three/tsl'
import {Vector2, Vector3} from 'three/webgpu'

/**
 * The fusion warp drawn this frame (see `RealityWarp`), which bends the view the scene pass drew behind it. The screen-space passes work on the unbent depth and normals, so the pipeline reads what they found where the view each pixel shows comes from; otherwise their shading, like the ambient occlusion along a frame or a cornice, would stay put while the view twists away beneath it.
 * The warp writes it while it draws, the pipeline lays it at rest before every scene pass; with two warps on screen at once, the last one drawn wins. Only heavy graphics read it.
 */
export const screenWarp = {
  /** where the ripple’s crest is, in reaches from the middle */
  front: uniform(0),
  /** the warp’s middle in the world */
  middle: new Vector3,
  /** how far the view is pulled toward the middle; negative pushes it out */
  pull: uniform(0),
  /** how far from its middle it bends the view, in meters; 0 while no warp draws */
  reach: 0,
  /** how far the ripple shifts the view, in reaches */
  ripple: uniform(0),
  /** radians the middle turns against the rim */
  twist: uniform(0),
}

/** how a warp bends the view around its middle */
export type WarpBend = Pick<typeof screenWarp, 'front' | 'pull' | 'ripple' | 'twist'>

/** Lays the warp at rest, until one draws again. */
export function resetWarp() {
  screenWarp.reach = 0
}

/** Where the view a warp shows at `point` comes from, both in reaches from its middle: twisted and pulled in toward its middle, or pushed out with a negative pull, and shifted by its ripple; from its rim on, the view is undisturbed. */
export function warpSource(point: Node<'vec2'>, {front, pull, ripple, twist}: WarpBend): Node<'vec2'> {
  const rho = point.length()
  const falloff = float(1).sub(rho).max(0)
  const swirled = rotate(point, twist.mul(falloff).mul(falloff)) as unknown as Node<'vec2'>
  const crest = rho.sub(front).div(0.1)
  const wave = exp(crest.mul(crest).negate()).mul(ripple).mul(falloff.mul(4).min(1))
  // Each point shows what lies farther out while the pull is positive, which draws the view in.
  return swirled.mul(pull.mul(falloff).mul(falloff).add(1)).add(point.div(max(rho, 1e-4)).mul(wave))
}

/** The screen point, in UV, mirrored at the edges of the screen as often as it takes to land on it, so a warp reaching past the edge of the view never runs out of view to show. */
export function mirrored(point: Node<'vec2'>) {
  return vec2(1).sub(abs(fract(point.mul(0.5)).mul(2).sub(1)))
}

const seen = new Vector3

/**
 * Where, in UV, the view each pixel shows through `camera` comes from, through the warp drawn this frame: `screenUV` wherever it doesn’t bend the view, and everywhere while no warp draws in front of the camera, which `bending` tells, 1 or 0.
 * The warp spans the camera’s right and up, so it lies parallel to the image, where the projection scales evenly.
 */
export function warpedScreenUV(camera: Camera) {
  const center = uniform(new Vector2(0.5, 0.5))
  const scale = uniform(new Vector2(1, 1))
  const look = () => {
    const {middle, reach} = screenWarp
    seen.copy(middle).applyMatrix4(camera.matrixWorldInverse)
    const depth = -seen.z
    if (reach <= 0 || depth <= 1e-3) {
      return 0
    }
    const [sx, , , , , sy] = camera.projectionMatrix.elements
    seen.applyMatrix4(camera.projectionMatrix)
    center.value.set(seen.x * 0.5 + 0.5, 0.5 - seen.y * 0.5)
    scale.value.set(sx * reach / depth / 2, -sy * reach / depth / 2)
    return 1
  }
  // Whichever of them updates first looks where the warp is this frame.
  center.onRenderUpdate(() => {
    look()
    return center.value
  })
  scale.onRenderUpdate(() => {
    look()
    return scale.value
  })
  const bending = uniform(0).onRenderUpdate(look)
  const bent = mirrored(center.add(warpSource(screenUV.sub(center).div(scale), screenWarp).mul(scale)))
  return {
    bending,
    uv: select(bending.greaterThan(0), bent, screenUV),
  }
}
