import type {Node} from 'three/webgpu'

import {cameraProjectionMatrix, cameraViewMatrix, cameraWorldMatrix, exp, float, modelWorldMatrix, positionGeometry, smoothstep, texture, uniform, uv, vec2, vec3, vec4, viewportSharedTexture} from 'three/tsl'
import {Mesh, MeshBasicNodeMaterial, PlaneGeometry} from 'three/webgpu'

import {mirrored, screenWarp, warpSource} from '../../rendering/screenWarp.ts'
import TransparentSpriteOutputsNode from '../../rendering/TransparentSpriteOutputsNode.ts'

/**
 * A wide stretch of the view around a fusion’s portal, bent as if the portal swallowed space itself: pulled toward the middle and twisted like water down a drain, darkened toward the middle and split into its colors, or, with a negative pull, pushed back out while a ripple runs outward over it.
 * A camera-facing quad that redraws the scene behind it through `viewportSharedTexture`. It draws without depth, so whatever stands in front of the portal bends along, and before the portal’s own quads, which blend over it. At its rim the view is undisturbed, so its edge never shows. Where it reaches past the edge of the screen, which it does once the camera is close, it reads the view mirrored at that edge, so it never runs out of view to show.
 * While it draws, it tells the pipeline how it bends the view (see `screenWarp`), so the shading of the screen-space passes bends along.
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
    const {chroma, darkness, reach} = this.uniforms
    const right = cameraWorldMatrix.mul(vec4(1, 0, 0, 0)).xyz
    const upward = cameraWorldMatrix.mul(vec4(0, 1, 0, 0)).xyz
    material.positionNode = right.mul(positionGeometry.x).add(upward.mul(positionGeometry.y)).mul(reach)
    // in reaches, from the middle
    const p = uv().sub(0.5).mul(2).toVar('warpPoint')
    const rho = p.length().toVar('warpDistance')
    const falloff = float(1).sub(rho).max(0).toVar('warpFalloff')
    const source = warpSource(p, this.uniforms).toVar('warpSource')
    const middle = modelWorldMatrix.mul(vec4(0, 0, 0, 1)).xyz
    const onScreen = (point: Node<'vec2'>) => {
      const world = middle.add(right.mul(point.x).add(upward.mul(point.y)).mul(reach))
      const clip = cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(world, 1))
      return clip.xy.div(clip.w).mul(vec2(0.5, -0.5)).add(0.5)
    }
    const split = falloff.mul(chroma)
    const view = viewportSharedTexture(mirrored(onScreen(source)))
    // Only this node copies the view each render; the other channels read its copy instead of copying it again.
    const copy = view.value
    const red = texture(copy, mirrored(onScreen(source.mul(split.add(1))))).r
    const blue = texture(copy, mirrored(onScreen(source.mul(float(1).sub(split))))).b
    // Light falls into the middle: a dark well around it and a dimmer stretch all over.
    const well = exp(rho.mul(rho).mul(-60)).mul(darkness)
    const dim = float(1).sub(well).mul(float(1).sub(darkness.mul(0.35).mul(falloff)))
    material.colorNode = vec3(red, (view as unknown as Node<'vec4'>).g, blue).mul(dim)
    material.opacityNode = smoothstep(1, 0.9, rho)
    this.onBeforeRender = () => {
      const {front, pull, ripple, twist} = this.uniforms
      screenWarp.front.value = front.value
      screenWarp.pull.value = pull.value
      screenWarp.ripple.value = ripple.value
      screenWarp.twist.value = twist.value
      screenWarp.reach = reach.value
      this.getWorldPosition(screenWarp.middle)
    }
  }

  dispose() {
    this.geometry.dispose()
    this.material.dispose()
  }
}
