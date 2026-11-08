import type {Node} from 'three/webgpu'

import {cameraProjectionMatrix, cameraViewMatrix, cameraWorldMatrix, exp, float, max, modelWorldMatrix, positionGeometry, rotate, smoothstep, texture, uniform, uv, vec2, vec3, vec4, viewportSharedTexture} from 'three/tsl'
import {Mesh, MeshBasicNodeMaterial, PlaneGeometry} from 'three/webgpu'

import TransparentSpriteOutputsNode from '../../rendering/TransparentSpriteOutputsNode.ts'

/**
 * A wide stretch of the view around a fusion’s portal, bent as if the portal swallowed space itself: pulled toward the middle and twisted like water down a drain, darkened toward the middle and split into its colors, or, with a negative pull, pushed back out while a ripple runs outward over it.
 * A camera-facing quad that redraws the scene behind it through `viewportSharedTexture`. It draws without depth, so whatever stands in front of the portal bends along, and before the portal’s own quads, which blend over it. At its rim the view is undisturbed, so its edge never shows.
 */
export default class RealityWarp extends Mesh<PlaneGeometry, MeshBasicNodeMaterial> {
  readonly uniforms = {
    /** how far the colors split toward the middle */
    chroma: uniform(0),
    /** how dark the middle turns, 0–1 */
    darkness: uniform(0),
    /** where the ripple’s crest is, in reaches from the middle */
    front: uniform(0),
    /** how far the view is pulled toward the middle; negative pushes it out. Between −1 and 3 the view never folds over itself. */
    pull: uniform(0),
    /** how far from the portal’s middle the view bends, in meters; 0 hides it */
    reach: uniform(0),
    /** how far the ripple shifts the view, in reaches */
    ripple: uniform(0),
    /** radians the middle turns against the rim */
    twist: uniform(0),
  }

  constructor() {
    const material = new MeshBasicNodeMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    })
    material.name = 'fusion-warp'
    // The view it redraws keeps the normal and motion of what is behind.
    material.mrtNode = new TransparentSpriteOutputsNode
    super(new PlaneGeometry(2, 2), material)
    this.name = 'fusion-warp'
    // It redraws the view before the portal’s own quads blend over it.
    this.renderOrder = -1
    // The vertex shader places the quad, so its bounds say nothing.
    this.frustumCulled = false
    const {chroma, darkness, front, pull, reach, ripple, twist} = this.uniforms
    const right = cameraWorldMatrix.mul(vec4(1, 0, 0, 0)).xyz
    const upward = cameraWorldMatrix.mul(vec4(0, 1, 0, 0)).xyz
    material.positionNode = right.mul(positionGeometry.x).add(upward.mul(positionGeometry.y)).mul(reach)
    // in reaches, from the middle
    const p = uv().sub(0.5).mul(2).toVar('warpPoint')
    const rho = p.length().toVar('warpDistance')
    const falloff = float(1).sub(rho).max(0).toVar('warpFalloff')
    const swirled = rotate(p, twist.mul(falloff).mul(falloff)) as unknown as Node<'vec2'>
    const crest = rho.sub(front).div(0.1)
    const wave = exp(crest.mul(crest).negate()).mul(ripple).mul(falloff.mul(4).min(1))
    // Each point shows what lies farther out while the pull is positive, which draws the view in.
    const source = swirled.mul(pull.mul(falloff).mul(falloff).add(1)).add(p.div(max(rho, 1e-4)).mul(wave)).toVar('warpSource')
    const middle = modelWorldMatrix.mul(vec4(0, 0, 0, 1)).xyz
    const onScreen = (point: Node<'vec2'>) => {
      const world = middle.add(right.mul(point.x).add(upward.mul(point.y)).mul(reach))
      const clip = cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(world, 1))
      return clip.xy.div(clip.w).mul(vec2(0.5, -0.5)).add(0.5)
    }
    const split = falloff.mul(chroma)
    const seen = onScreen(source).toVar('warpSeen')
    // Where the pull reaches past the edge of the view, nothing is left to show but the dark.
    const within = smoothstep(-0.03, 0, seen.x).mul(smoothstep(1.03, 1, seen.x)).mul(smoothstep(-0.03, 0, seen.y)).mul(smoothstep(1.03, 1, seen.y))
    const view = viewportSharedTexture(seen.clamp(0, 1))
    // Only this node copies the view each render; the other channels read its copy instead of copying it again.
    const copy = view.value
    const red = texture(copy, onScreen(source.mul(split.add(1))).clamp(0, 1)).r
    const blue = texture(copy, onScreen(source.mul(float(1).sub(split))).clamp(0, 1)).b
    // Light falls into the middle: a dark well around it and a dimmer stretch all over.
    const well = exp(rho.mul(rho).mul(-60)).mul(darkness)
    const dim = float(1).sub(well).mul(float(1).sub(darkness.mul(0.35).mul(falloff))).mul(within)
    material.colorNode = vec3(red, (view as unknown as Node<'vec4'>).g, blue).mul(dim)
    material.opacityNode = smoothstep(1, 0.9, rho)
  }

  dispose() {
    this.geometry.dispose()
    this.material.dispose()
  }
}
