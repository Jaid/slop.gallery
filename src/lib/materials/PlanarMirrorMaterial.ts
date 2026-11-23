import type Node from 'three/src/nodes/core/Node.js'
import type NodeBuilder from 'three/src/nodes/core/NodeBuilder.js'
import type NodeFrame from 'three/src/nodes/core/NodeFrame.js'
import type {Camera, MRTNode, Renderer, Scene, Texture} from 'three/webgpu'

import {cos, float, Fn, frameId, If, int, interleavedGradientNoise, materialRoughness, mix, normalView, output, positionViewDirection, reflector, screenCoordinate, sin, textureBicubicLevel, uniform, vec2, vec4} from 'three/tsl'
import {Box3, DepthTexture, Frustum, HalfFloatType, LinearMipMapLinearFilter, Matrix4, MeshStandardNodeMaterial, NodeUpdateType, Object3D, RenderTarget, Vector3, VelocityNode} from 'three/webgpu'

/** what the reflection needs from the pass it is reflected into */
export type ReflectionPass = {
  camera: Camera
  mrt: MRTNode | null
  renderer: Renderer
  /** reflection pixels per pixel of the pass along each axis */
  resolutionScale?: number
  scene: Scene
  target: RenderTarget
}

export type PlanarReflection = {
  /** radius of the Gaussian blur over the mirror, in pixels of a 1080-row image; 0 leaves it unblurred */
  gaussianBlur?: number
  grazingStrength: number
  /** mip level the mirror is read at, 0 being its full resolution and every step halving it */
  loss: Node<'float'> | number
  mask?: Node<'float'>
  strength: number
}
type Reflection = ReturnType<typeof reflector>

let shared: {
  reflection: Reflection
  render: (pass: ReflectionPass) => void
  surfaces: Set<PlanarMirrorMaterial>
} | null = null
let reflecting = false
// The reflection renders the scene with the main pass’s outputs, motion included. Velocity remembers each object’s matrix after drawing it for the next frame, which the main pass still has to see.
const {updateAfter} = VelocityNode.prototype as {updateAfter: (this: VelocityNode, frame: NodeFrame) => void}
VelocityNode.prototype.updateAfter = function (this: VelocityNode, frame) {
  if (!reflecting) {
    updateAfter.call(this, frame)
  }
}
const bounds = new Box3
const frustum = new Frustum
const projection = new Matrix4
const point = new Vector3
/** The Sandbox and Knottingham have one plane at ground level. The gallery selects its plane by fence; null disables the pass. */
let mirroredHeight: number | null = 0
/** Selects one horizontal plane in world space, or none. The target’s local +z sets which side reflects. */
export function setReflectionHeight(height: number | null) {
  mirroredHeight = height
}
/** the height used by both the mirror pass and the culler, or null when neither needs the mirrored view */
export function getReflectionHeight() {
  return mirroredHeight
}
/** factor on every surface’s reflectance, which the render pipeline sets to 0 when it renders no reflection */
export const mirrorReflectionStrength = uniform(1)
/** factor on every surface’s extra reflectance at grazing angles */
export const mirrorReflectionGrazing = uniform(1)
/** factor on every surface’s loss, the mip level of the mirror it reads */
export const mirrorReflectionLevel = uniform(1)
/** factor on every surface’s Gaussian blur radius */
export const mirrorReflectionBlur = uniform(1)
/** taps of the mirror blur, spread evenly over a disk */
const blurTaps = 16
/** the golden angle, which spreads consecutive taps around the disk without lining up */
const goldenAngle = Math.PI * (3 - Math.sqrt(5))
/** factor on every reflective surface’s roughness, which shapes its highlights and environment lighting but not its mirror */
export const mirrorReflectionRoughness = uniform(1)
/** mip levels the reflection lacks when rendered below native resolution, which every surface’s loss already covers */
const reflectionLevelBias = uniform(0)
/** Renders the shared surface reflection for the main pass about to render, if a surface will be in view. */
export function renderPlanarReflection(pass: ReflectionPass) {
  shared?.render(pass)
}
/**
 * Reads the mirror at a mip level through a B-spline filter: a plain lookup of a coarse mip magnifies its texels bilinearly, which shows as blocky stair-steps around bright shapes.
 *
 * With a blur radius, it averages Gaussian-weighted taps over a disk around the point instead. Each tap reads a mip with about two texels between neighboring taps, fine enough that its texels don’t show as blocks, and the disk turns by a noise that changes per pixel and frame, so the antialiasing’s history averages the gaps between the taps into a smooth blur.
 */
function sampleMirror(reflection: Reflection, level: Node<'float'>, gaussianBlur: Node<'float'>) {
  const smooth = textureBicubicLevel(reflection, level)
  return Fn(() => {
    const result = vec4(0).toVar('planarMirror')
    const radius = mirrorReflectionBlur.mul(gaussianBlur).div(1080).toVar('planarMirrorBlur')
    If(radius.greaterThan(0), () => {
      const size = vec2(reflection.size(int(0)) as Node<'ivec2'>)
      const tapLevel = radius.mul(size.y).mul(1 / Math.sqrt(blurTaps)).max(1).log2().max(level)
      const turn = interleavedGradientNoise(screenCoordinate.xy.add(float(frameId).mod(64).mul(5.588238))).mul(2 * Math.PI)
      // Offsets are in fractions of the image height; x shrinks by the aspect ratio so the disk stays round.
      const scale = vec2(size.y.div(size.x), 1).mul(radius)
      const uv = reflection.uvNode as Node<'vec2'>
      let sum: Node<'vec4'> = vec4(0)
      let total = 0
      for (let i = 0; i < blurTaps; i++) {
        const distance = Math.sqrt((i + 0.5) / blurTaps)
        const angle = turn.add(i * goldenAngle)
        const weight = Math.exp(-2 * distance ** 2)
        sum = sum.add(reflection.sample(uv.add(vec2(cos(angle), sin(angle)).mul(distance).mul(scale))).level(tapLevel).mul(weight))
        total += weight
      }
      result.assign(sum.div(total))
    }).Else(() => {
      result.assign(smooth)
    })
    return result
  })()
}
/** Bounds the surface a reflection target lies in: its nearest ancestor with geometry, since some surfaces keep the target in a group of its own. */
function surfaceBounds(target: Object3D) {
  for (let node = target.parent; node; node = node.parent) {
    if (!bounds.setFromObject(node).isEmpty()) {
      break
    }
  }
  return bounds
}
/**
 * All mirror surfaces share one reflector. Only materials in the selected horizontal plane mix it over their shading; if none of them is in view the pass is skipped.
 * Every material sampling the reflection hides while it renders, since a pass can’t sample the texture it draws into.
 *
 * The reflection renders right before the main pass, with the same outputs into a target of the same layout, so every material shares its shaders between both instead of building them twice. Rendered from within the main pass, it would be one call deeper and get shaders of its own.
 */
function acquireReflection(surface: PlanarMirrorMaterial) {
  if (!shared) {
    const reflection = reflector({
      // Native-resolution reflections retain mipmap LOD filtering for rough surfaces. Each pass may render it at a scale of its own.
      resolutionScale: 1,
      generateMipmaps: true,
      bounces: false,
    })
    const surfaces = new Set<PlanarMirrorMaterial>
    const base = reflection.reflector as typeof reflection.reflector & {
      getRenderTarget: (camera: Camera) => RenderTarget
      renderTargets: Map<Camera, RenderTarget>
    }
    const update = base.updateBefore.bind(base)
    base.updateBeforeType = NodeUpdateType.NONE
    // The target takes the layout of the pass the reflection renders for, and holds color alone until there is one.
    let layout: RenderTarget | null = null
    base.getRenderTarget = camera => {
      const count = layout?.textures.length ?? 1
      let renderTarget = base.renderTargets.get(camera)
      if (renderTarget?.textures.length !== count) {
        renderTarget?.dispose()
        renderTarget = new RenderTarget(1, 1, {
          type: HalfFloatType,
          samples: layout?.samples ?? 0,
          count,
        })
        // Only the color is sampled, with mipmaps for rough surfaces.
        renderTarget.texture.minFilter = LinearMipMapLinearFilter
        renderTarget.texture.generateMipmaps = true
        if (layout) {
          for (const [i, texture] of renderTarget.textures.entries()) {
            texture.name = layout.textures[i].name
          }
          if (layout.depthTexture) {
            renderTarget.depthTexture = new DepthTexture
            renderTarget.depthTexture.type = layout.depthTexture.type
          }
        }
        base.renderTargets.set(camera, renderTarget)
      }
      return renderTarget
    }
    const render = ({camera, mrt, renderer, resolutionScale = 1, scene, target}: ReflectionPass) => {
      // The frame’s matrices aren’t updated yet. A target not yet attached has no world plane.
      camera.updateWorldMatrix(true, false)
      frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse), camera.coordinateSystem, camera.reversedDepth)
      let mirror: PlanarMirrorMaterial | undefined
      for (const candidate of surfaces) {
        const plane = candidate.reflectionTarget!
        // Coplanar finishes can stand a few millimeters proud of their slab.
        const selected = mirroredHeight !== null && plane.parent !== null && Math.abs(plane.getWorldPosition(point).y - mirroredHeight) < 0.01
        candidate.mirrored.value = selected ? 1 : 0
        if (selected && !mirror && frustum.intersectsBox(surfaceBounds(plane))) {
          mirror = candidate
        }
      }
      if (!mirror) {
        return
      }
      base.target = mirror.reflectionTarget!
      base.resolutionScale = resolutionScale
      // A surface sampling mip level n of a native-resolution target only sees a 2ⁿ-fold coarser image, so a smaller target loses nothing as long as the level shrinks along with it.
      reflectionLevelBias.value = Math.min(Math.log2(resolutionScale), 0)
      layout = target
      const visible = [...surfaces].map(candidate => candidate.visible)
      for (const candidate of surfaces) {
        candidate.visible = false
      }
      // The reflector clears the outputs to render color alone; it gets the main pass’s outputs instead.
      const {setMRT} = renderer as {setMRT: (this: Renderer, next: MRTNode | null) => Renderer}
      let cleared = false
      renderer.setMRT = function (this: Renderer, next) {
        if (!cleared && next === null) {
          cleared = true
          return setMRT.call(this, mrt)
        }
        return setMRT.call(this, next)
      }
      reflecting = true
      try {
        update({
          camera,
          material: mirror,
          renderer,
          scene,
        } as unknown as NodeFrame)
      } finally {
        reflecting = false
        delete (renderer as Partial<Renderer>).setMRT
        let i = 0
        for (const candidate of surfaces) {
          candidate.visible = visible[i++]!
        }
      }
    }
    shared = {
      surfaces,
      reflection,
      render,
    }
  }
  shared.surfaces.add(surface)
  return shared.reflection
}
function releaseReflection(surface: PlanarMirrorMaterial) {
  if (shared?.surfaces.delete(surface) && shared.surfaces.size === 0) {
    shared.reflection.dispose()
    shared = null
  }
}

/**
 * Optional planar reflection ownership; fast-mode materials allocate no reflection targets.
 *
 * Procedural surfaces pass no `map` and set their own `colorNode`; the reflection mixes over whatever the surface shades to.
 */
export default class PlanarMirrorMaterial extends MeshStandardNodeMaterial {
  /** 1 only after the pass selects this material’s plane */
  readonly mirrored = uniform(0)
  readonly reflection: Reflection | null
  /** the radius of the Gaussian blur over this surface’s mirror, in pixels of a 1080-row image, as made unless set anew; 0 leaves it unblurred */
  readonly reflectionBlur = uniform(0)
  /** factor on this surface’s reflectance, 1 as made */
  readonly reflectionStrength = uniform(1)
  /** place this target in the surface plane with local +z facing the viewer’s side */
  readonly reflectionTarget: Object3D | null

  constructor(map: Texture | null, {color, envMapIntensity, roughness, reflection}: {
    color: string
    /** the environment’s share of the lighting, by default all of it on a reflective surface and none on a matte one */
    envMapIntensity?: number
    reflection?: PlanarReflection
    roughness: number
  }) {
    super({
      map,
      color,
      roughness,
      metalness: 0,
      envMapIntensity: envMapIntensity ?? (reflection ? 1 : 0),
    })
    this.reflectionTarget = reflection ? new Object3D : null
    this.reflection = this.reflectionTarget ? acquireReflection(this) : null
    if (this.reflection && reflection) {
      const grazing = normalView.dot(positionViewDirection).abs().oneMinus().pow(5)
      const reflectance = grazing.mul(reflection.grazingStrength).mul(mirrorReflectionGrazing).add(reflection.strength).mul(reflection.mask ?? float(1)).mul(mirrorReflectionStrength).mul(this.reflectionStrength).mul(this.mirrored)
      const loss = typeof reflection.loss === 'number' ? float(reflection.loss) : reflection.loss
      this.reflectionBlur.value = reflection.gaussianBlur ?? 0
      const mirror = sampleMirror(this.reflection, loss.mul(mirrorReflectionLevel).add(reflectionLevelBias).max(0), this.reflectionBlur)
      this.outputNode = vec4(mix(output.rgb, mirror.rgb, reflectance), output.a)
    }
  }

  override dispose() {
    if (this.reflectionTarget) {
      releaseReflection(this)
    }
    super.dispose()
  }

  override setupVariants(builder: NodeBuilder) {
    if (!this.reflection) {
      super.setupVariants(builder)
      return
    }
    // Scales the roughness for this build only, so rebuilding never stacks the factor.
    const {roughnessNode} = this
    this.roughnessNode = ((roughnessNode ?? materialRoughness) as Node<'float'>).mul(mirrorReflectionRoughness).min(1)
    super.setupVariants(builder)
    this.roughnessNode = roughnessNode
  }
}
