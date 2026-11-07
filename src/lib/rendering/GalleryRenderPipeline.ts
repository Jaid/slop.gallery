import type {RenderPipelineSettings, RenderPipelineUniform} from './renderPipelineSettings.ts'
import type {Camera, Node, NodeMaterial, Object3D, Renderer, RenderTarget, Scene, TextureNode} from 'three/webgpu'

import {WireframeFloodPass} from 'capture-session'
import {vxgi} from 'three/addons/lighting/vxgi/VXGINode.js'
import {denoise} from 'three/addons/tsl/display/DenoiseNode.js'
import {depthAwareBlend} from 'three/addons/tsl/display/depthAwareBlend.js'
import {gaussianBlur} from 'three/addons/tsl/display/GaussianBlurNode.js'
import {godrays} from 'three/addons/tsl/display/GodraysNode.js'
import {ao} from 'three/addons/tsl/display/GTAONode.js'
import {ssgi} from 'three/addons/tsl/display/SSGINode.js'
import {ssr} from 'three/addons/tsl/display/SSRNode.js'
import {sss} from 'three/addons/tsl/display/SSSNode.js'
import {traa} from 'three/addons/tsl/display/TRAANode.js'
import {convertToTexture, diffuseColor, exp, float, int, interleavedGradientNoise, length, luminance, max, metalness, min, mix, mrt, normalView, output, pass, renderOutput, roughness, rtt, screenCoordinate, screenSize, screenUV, smoothstep, uniform, uv, vec2, vec3, vec4, velocity} from 'three/tsl'
import {BlendMode, DirectionalLight, HalfFloatType, NoBlending, NormalBlending, PerspectiveCamera, RenderPipeline, Vector2} from 'three/webgpu'

import {mountedRooms, pendingRooms} from '../gallery/roomLoading.ts'
import {floorReflectionBlur, floorReflectionGrazing, floorReflectionLevel, floorReflectionRoughness, floorReflectionStrength, renderFloorReflection} from '../materials/FloorMaterial.ts'
import ConditionalTexture from './ConditionalTexture.ts'
import ConfigurableBloomNode from './ConfigurableBloomNode.ts'
import {GalleryRenderer} from './GalleryRenderer.ts'
import KnotBokeh from './KnotBokeh.ts'
import {gradeMood} from './moodGrade.ts'
import {impactActive, screenImpact} from './screenImpact.ts'
import tiltShift from './tiltShift.ts'
import ZoomBlur from './ZoomBlur.ts'

/** the most rows ambient occlusion, the screen-space indirect light and the floor reflection render at; at Cinematic’s 2× a 4320p snap would need 8640 rows of each and runs a 16 GB GPU out of memory, while 4320p at 1× already supersamples a 2160p image */
const maxEffectRows = 4320
const drawingBufferSize = new Vector2
const capResolutionScale = (renderer: Renderer, scale: number) => Math.min(scale, maxEffectRows / renderer.getDrawingBufferSize(drawingBufferSize).height)

export type GalleryRenderPipelineOptions = {
  focus?: {
    amount: () => number
    /** scales the lens blur’s radius; 0 keeps the background sharp */
    blur?: () => number
    distance: () => number
    proximity: () => number
  }
  /** whether the passes past antialiasing run; without it the settings only pick the antialiasing and the floor reflections */
  heavy?: boolean
  settings: RenderPipelineSettings
  /** how much of the sun the air around the camera holds, which scales the sun shafts; 0 where the sun never reaches but its shadow map has no walls */
  volumetricLightReach?: () => number
  zoom?: () => number
}

/** All depth-dependent work stays in the current frame; one antialiasing resolve (TRAA by default) antialiases the finished composite. */
export default class GalleryRenderPipeline extends RenderPipeline {
  readonly scenePass: ReturnType<typeof pass>
  /** every uniform the settings set, with the setting it came from, so a subclass can change them live */
  protected readonly uniforms: Array<[{value: number}, RenderPipelineUniform]> = []
  private readonly effects: Array<{dispose: () => void}> = []

  constructor(renderer: Renderer, scene: Object3D, camera: Camera, {focus, heavy = true, settings, volumetricLightReach = () => 1, zoom = () => 0}: GalleryRenderPipelineOptions) {
    super(renderer)
    const {antiAliasing, mirrorReflections, screenSpaceReflections} = settings
    const indirectLight = settings.screenSpaceIndirectLight || settings.voxelIndirectLight
    const own = <T extends {dispose: () => void}>(effect: T) => {
      this.effects.push(effect)
      return effect
    }
    const set = (node: {value: number}, key: RenderPipelineUniform) => {
      node.value = settings[key]
      this.uniforms.push([node, key])
    }
    // The floor materials keep sampling their mirror, which turns dark once it is no longer rendered.
    if (mirrorReflections) {
      set(floorReflectionStrength, 'mirrorReflectionStrength')
      set(floorReflectionGrazing, 'mirrorReflectionGrazing')
      set(floorReflectionLevel, 'mirrorReflectionLevel')
      set(floorReflectionBlur, 'mirrorReflectionBlur')
      set(floorReflectionRoughness, 'mirrorReflectionRoughness')
    } else {
      floorReflectionStrength.value = 0
      floorReflectionRoughness.value = 1
    }
    // GTAO and TRAA require single-sampled scene depth.
    const scenePass = own(pass(scene, camera, {samples: 0}))
    this.scenePass = scenePass
    const renderScene = scenePass.updateBefore.bind(scenePass)
    // The wireframe flood draws into targets of its own right after the scene pass, with the same camera, but only while it is enabled
    const flood = own(new WireframeFloodPass(renderer, scene as Scene, camera))
    scenePass.updateBefore = frame => {
      const reflect = () => {
        // Its pipelines are mostly the scene pass’s, so the loading screen’s warmup skips it; streaming builds what it draws over the frames after loading.
        if (!mirrorReflections || renderer instanceof GalleryRenderer && renderer.isWarming) {
          return
        }
        renderFloorReflection({
          camera,
          mrt: scenePass.getMRT(),
          renderer,
          resolutionScale: capResolutionScale(renderer, settings.reflectionResolutionScale),
          scene: scene as Scene,
          target: scenePass.renderTarget,
        })
      }
      // The reflection sees what the camera’s pass sees.
      if (renderer instanceof GalleryRenderer) {
        renderer.prepass(scene, camera, reflect)
      } else {
        reflect()
      }
      const result = renderScene(frame)
      flood.draw()
      return result
    }
    if (heavy || antiAliasing === 'traa') {
      const outputs = mrt({
        output,
        ...heavy ? {normal: normalView} : {},
        ...heavy && indirectLight ? {diffuseColor} : {},
        ...heavy && screenSpaceReflections ? {metalrough: vec2(metalness, roughness)} : {},
        ...antiAliasing === 'traa' ? {velocity} : {},
      })
      // The geometry buffers blend by their own alpha. Every material writes them with alpha 1, which overwrites like before; a soft sprite can write alpha 0 through its `mrtNode` (see `TransparentSpriteOutputsNode`) to leave the normal and motion of what is behind it alone, which the ambient occlusion and the temporal resolve read.
      for (const name of ['normal', 'velocity', 'diffuseColor']) {
        outputs.setBlendMode(name, new BlendMode(NormalBlending))
      }
      scenePass.setMRT(outputs)
    }
    const depth = scenePass.getTextureNode('depth')
    let current: Node<'vec4'> = scenePass.getTextureNode('output')
    if (heavy) {
      const normal = scenePass.getTextureNode('normal')
      // The denoise node’s declaration lacks the node extensions every other node has.
      const smooth = (input: Node<'vec4'>) => own(denoise(input, depth, normal, camera)) as unknown as Node<'vec4'>
      if (settings.ambientOcclusion) {
        const ambientOcclusion = own(ao(depth, normal, camera))
        // It sizes its targets each frame from the drawing buffer, so the cap follows resizes.
        const updateAmbientOcclusion = ambientOcclusion.updateBefore.bind(ambientOcclusion)
        ambientOcclusion.updateBefore = frame => {
          ambientOcclusion.resolutionScale = capResolutionScale(renderer, settings.ambientOcclusionResolutionScale)
          return updateAmbientOcclusion(frame)
        }
        ambientOcclusion.useTemporalFiltering = settings.ambientOcclusionTemporalFiltering
        set(ambientOcclusion.radius, 'ambientOcclusionRadius')
        set(ambientOcclusion.thickness, 'ambientOcclusionThickness')
        set(ambientOcclusion.scale, 'ambientOcclusionScale')
        set(ambientOcclusion.samples, 'ambientOcclusionSamples')
        current = current.mul(vec4(vec3(ambientOcclusion.getTextureNode().r), 1))
      }
      if (indirectLight && camera instanceof PerspectiveCamera) {
        const bounces: Array<Node<'vec3'>> = []
        if (settings.screenSpaceIndirectLight) {
          // The light the lit scene bounces onto nearby surfaces, tinted by their diffuse color. Its temporal noise resolves in TRAA.
          const indirect = own(ssgi(scenePass.getTextureNode('output'), depth, normal, camera))
          // Like the ambient occlusion, it sizes its target each frame from the drawing buffer.
          const updateIndirect = indirect.updateBefore.bind(indirect)
          indirect.updateBefore = frame => {
            indirect.resolutionScale = capResolutionScale(renderer, settings.screenSpaceIndirectLightResolutionScale)
            return updateIndirect(frame)
          }
          set(indirect.sliceCount, 'screenSpaceIndirectLightSlices')
          set(indirect.stepCount, 'screenSpaceIndirectLightSteps')
          set(indirect.giIntensity, 'screenSpaceIndirectLightIntensity')
          set(indirect.radius, 'screenSpaceIndirectLightRadius')
          set(indirect.thickness, 'screenSpaceIndirectLightThickness')
          set(indirect.expFactor, 'screenSpaceIndirectLightExpFactor')
          set(indirect.backfaceLighting, 'screenSpaceIndirectLightBackfaceLighting')
          // Its own ambient occlusion is 1 everywhere at intensity 0.
          set(indirect.aoIntensity, 'screenSpaceIndirectLightAmbientOcclusion')
          indirect.useTemporalFiltering = settings.screenSpaceIndirectLightTemporalFiltering
          current = vec4(current.rgb.mul(indirect.getAONode()), current.a)
          // Without TRAA, nothing averages the per-pixel samples, so their fireflies are clamped and a spatial pass smooths them instead.
          bounces.push(antiAliasing === 'traa' ? indirect.getGINode().rgb : smooth(vec4(indirect.getGINode().rgb.min(0.3), 1)).rgb)
        }
        if (settings.voxelIndirectLight) {
          // Voxel cone tracing adds the bounces from what is off screen or hidden, which the screen-space pass cannot see. Faint, since it brightens far more than SSGI.
          const voxel = own(vxgi(depth, normal, scene as Scene, camera, settings.voxelIndirectLightResolution))
          // Its volume recomposes every matrix of the scene each frame before collecting the lights. Within the frame’s prepass it uses the matrices the scene pass already brought up to date.
          if (renderer instanceof GalleryRenderer) {
            const updateVoxels = voxel.updateBefore.bind(voxel)
            let shownFrames = 0
            /** how many rooms had mounted when the scene was last voxelized, or -1 before that */
            let voxelizedRooms = -1
            voxel.updateBefore = frame => {
              // Voxelizing gathers every triangle of the scene on the CPU and builds pipelines of its own, which takes most of a second. It waits until the third frame after the loading screen: the menu enables Enter in a task after the first, and only the frame after that paints it. Until then, the voxels bounce no light.
              shownFrames = renderer.isWarming ? 0 : shownFrames + 1
              // It also waits for the rooms that load after the loading screen, and voxelizes again whenever more rooms are in.
              if (shownFrames < 3 || voxelizedRooms < 0 && pendingRooms() > 0) {
                return
              }
              if (voxelizedRooms !== mountedRooms() && pendingRooms() === 0) {
                // The first update voxelizes anyway.
                if (voxelizedRooms >= 0) {
                  voxel.needsUpdate = true
                }
                voxelizedRooms = mountedRooms()
              }
              renderer.prepass(scene, camera, () => {
                updateVoxels(frame)
              })
            }
          }
          set({
            set value(count: number) {
              voxel.bounces = count
            },
          }, 'voxelIndirectLightBounces')
          set(voxel.giIntensity, 'voxelIndirectLightIntensity')
          set(voxel.coneCount, 'voxelIndirectLightConeCount')
          set(voxel.coneAngle, 'voxelIndirectLightConeAngle')
          voxel.useTemporalFiltering = antiAliasing === 'traa'
          bounces.push(voxel.getGINode().rgb)
        }
        if (bounces.length > 0) {
          current = vec4(current.rgb.add(scenePass.getTextureNode('diffuseColor').rgb.mul(bounces.reduce((sum, bounce) => sum.add(bounce)))), current.a)
        }
      }
      let sun: DirectionalLight | undefined
      scene.traverse(object => {
        if (!sun && object instanceof DirectionalLight && object.castShadow) {
          sun = object
        }
      })
      if (screenSpaceReflections && camera instanceof PerspectiveCamera) {
        // Screen-space reflections on the metallic surfaces, like gilded frames and trims, blurred by their roughness, on top of the floors’ planar mirror. The non-stochastic pass weighs every hit by metalness, so dielectrics would only cost time; a dark metal writes its reflectance there instead through its own outputs (see `MaterialOutputsNode`), or it would mirror its surroundings as brightly as gold. Their fifth scene target needs the higher attachment limit that cinematic and `?development` request, and the normal goes in as the texture node despite the `vec3` typing, because the pass samples it at neighboring texels.
        const metalRoughness = scenePass.getTextureNode('metalrough')
        const reflection = own(ssr(scenePass.getTextureNode('output'), depth, normal as unknown as Node<'vec3'>, {
          camera,
          metalnessNode: metalRoughness.r,
          roughnessNode: metalRoughness.g,
        }))
        reflection.resolutionScale = settings.screenSpaceReflectionResolutionScale
        set(reflection.maxDistance, 'screenSpaceReflectionDistance')
        set(reflection.thickness, 'screenSpaceReflectionThickness')
        set(reflection.intensity, 'screenSpaceReflectionIntensity')
        // The pass writes the weighted reflection in RGB and the hit distance in alpha, so it adds on rather than blends.
        current = current.add(vec4(reflection.getTextureNode().rgb, 0))
      }
      if (settings.contactShadows && sun) {
        // Marches a short way toward the sun from every pixel, which darkens the small contacts the shadow map is too coarse for.
        const contact = own(sss(depth, camera, sun))
        contact.resolutionScale = settings.contactShadowResolutionScale
        set(contact.maxDistance, 'contactShadowDistance')
        set(contact.thickness, 'contactShadowThickness')
        set(contact.shadowIntensity, 'contactShadowIntensity')
        set(contact.quality, 'contactShadowQuality')
        contact.useTemporalFiltering = antiAliasing === 'traa'
        let shadow: Node<'vec4'> = contact.getTextureNode()
        if (settings.contactShadowDenoise) {
          const denoised = own(denoise(shadow, depth, normal, camera))
          set(denoised.radius, 'contactShadowDenoiseRadius')
          shadow = denoised as unknown as Node<'vec4'>
        }
        current = vec4(current.rgb.mul(shadow.r), current.a)
      }
      if (settings.volumetricLight && sun && camera instanceof PerspectiveCamera) {
        // Raymarches the sun’s shadow map through the air at full resolution; a plain Gaussian blur smooths the march, where an edge-preserving one would posterize it.
        const rays = own(godrays(depth, camera, sun))
        const density = {value: 0}
        set(density, 'volumetricLightDensity')
        // A sun switched off leaves no shafts.
        const shining = sun
        rays.density.onRenderUpdate(() => (shining.intensity > 0 ? density.value * volumetricLightReach() : 0))
        set(rays.maxDensity, 'volumetricLightMaxDensity')
        set(rays.raymarchSteps, 'volumetricLightSteps')
        set(rays.distanceAttenuation, 'volumetricLightDistanceAttenuation')
        rays.resolutionScale = settings.volumetricLightResolutionScale
        const blurred = own(gaussianBlur(rays.getTextureNode(), vec2(1), settings.volumetricLightBlur))
        // The addons default to 8-bit targets, which quantize the faint ray intensities into visible steps.
        const raysTargets = rays as unknown as {_godraysRenderTarget: RenderTarget}
        const blurTargets = blurred as unknown as {
          _horizontalRT: RenderTarget
          _verticalRT: RenderTarget
        }
        for (const target of [raysTargets._godraysRenderTarget, blurTargets._horizontalRT, blurTargets._verticalRT]) {
          target.texture.type = HalfFloatType
        }
        current = vec4(depthAwareBlend(convertToTexture(current), blurred.getTextureNode(), depth, camera, {
          blendColor: sun.color,
          edgeRadius: 2,
          edgeStrength: 2,
        }).rgb, current.a)
      }
    }
    // Native pixel color + native depth -> isolated background -> aperture gather -> composite. No temporal color or post-TRAA depth mask may enter this branch.
    let background: Node<'float'> = float(0)
    if (focus && camera instanceof PerspectiveCamera) {
      const amount = uniform(0).onRenderUpdate(focus.amount)
      const distance = uniform(1).onRenderUpdate(focus.distance)
      const proximity = uniform(0).onRenderUpdate(focus.proximity)
      const blur = uniform(1).onRenderUpdate(focus.blur ?? (() => 1))
      const bokeh = own(new KnotBokeh(current, scenePass.getViewZNode(), {
        amount,
        distance,
        radius: proximity.pow3().mul(26).add(8).mul(blur),
        enabled: () => focus.amount() > 0,
      }))
      current = bokeh.outputNode
      background = bokeh.backgroundNode
    }
    if (heavy) {
      // The canvas is opaque, so alpha carries the inspection bloom mask through the antialiasing resolve. The mask is still applied BEFORE temporal reconstruction, never as a raw, jittered stencil over antialiased color.
      current = vec4(current.rgb, float(1).sub(background))
    }
    // Own the materialized composite explicitly; Three's TRAANode and GaussianBlurNode do not dispose an implicit RTT.
    let composite: ReturnType<typeof rtt> | undefined
    if (antiAliasing === 'traa') {
      composite = own(rtt(current, null, null, {depthBuffer: false}))
      composite.name = 'galleryComposite'
      const temporal = own(traa(composite, depth, scenePass.getTextureNode('velocity'), camera))
      // The resolve is an opaque colorNode material, which forces alpha to 1. Without blending it is no longer opaque and keeps the resolved mask.
      ;(temporal as typeof temporal & {_resolveMaterial: NodeMaterial})._resolveMaterial.blending = NoBlending
      // The native accessor is missing from @types/three.
      current = (temporal as typeof temporal & {getTextureNode: () => TextureNode}).getTextureNode()
    }
    if (heavy && settings.bloom) {
      let mask: Node<'float'> = current.a.saturate()
      if (composite) {
        // TRAA clips only RGB, so the resolved mask can keep stale history after focus changes. The current mask, dilated by about 2 px, keeps the antialiased edge but never lets glow back onto distant background.
        const source = composite
        const reach = vec2(1.5).div(vec2(source.size(int(0)) as Node<'uvec2'>))
        let near: Node<'float'> = source.a
        for (const x of [-1, 0, 1]) {
          for (const y of [-1, 0, 1]) {
            if (x || y) {
              near = max(near, source.sample(uv().add(reach.mul(vec2(x, y)))).a)
            }
          }
        }
        mask = min(mask, near)
      }
      // Bloom MUST read the resolved image. Its hard luminance threshold and half-resolution downsample turn TRAA's subpixel jitter on small HDR features into frame-to-frame halo changes, and TRAA's variance clipping cannot calm such smooth, low-frequency flicker.
      const glow = own(new ConfigurableBloomNode(current, settings.bloomMipCount, settings.bloomGaussianKernelSize))
      glow.setResolutionScale(settings.bloomResolutionScale)
      set(glow.strength, 'bloomStrength')
      set(glow.radius, 'bloomRadius')
      set(glow.threshold, 'bloomThreshold')
      set(glow.smoothWidth, 'bloomSmoothWidth')
      const luminanceCap = uniform(0)
      set(luminanceCap, 'bloomLuminanceCap')
      // Stock high pass, but brightness-capped: a subpixel specular hit (clearcoat or glint on a rotating knot) would otherwise flash a full halo whenever it lands on a pixel.
      // A fusion’s impact lifts the cap along with the bloom’s strength.
      const cap = luminanceCap.mul(screenImpact.cap)
      glow.highPassFn = ({input, threshold, smoothWidth}) => {
        const value = luminance(input.rgb)
        const capped = input.rgb.mul(min(float(1), cap.div(max(value, 1e-4))))
        return vec4(capped.mul(smoothstep(threshold, threshold.add(smoothWidth), value)), 1)
      }
      current = vec4(current.rgb.add(glow.rgb.mul(mask).mul(screenImpact.bloom)), 1)
    } else if (heavy) {
      // Without glow, the inspection mask in alpha has nothing left to hold back.
      current = vec4(current.rgb, 1)
    }
    if (heavy) {
      const resolved = current
      const zoomEnabled = () => zoom() > 0
      // With no AA, only the blur and a fusion’s impact need a texture; keep the sharp path inline and skip its RTT outside them.
      const zoomSource = antiAliasing ? convertToTexture(resolved) : own(new ConditionalTexture(resolved, () => zoomEnabled() || impactActive()))
      if (!antiAliasing) {
        zoomSource.name = 'zoomSource'
      }
      const zoomAmount = uniform(0).onRenderUpdate(zoom)
      const zoomBlur = own(new ZoomBlur(zoomSource, zoomAmount, zoomEnabled))
      current = tiltShift(resolved, zoomBlur, zoomAmount)
      // A fusion’s impact resamples the resolved view: kicked in and shaken, bent by the ring running out from where it landed and split into its colors there.
      const {aberration, center, punch, ring, ringStrength, shake} = screenImpact
      const moving = uniform(0).onRenderUpdate(() => (impactActive() ? 1 : 0))
      const aspect = vec2(screenSize.x.div(screenSize.y), 1)
      const kicked = screenUV.sub(0.5).mul(float(1).sub(punch)).add(0.5).add(shake.div(aspect))
      const toward = kicked.sub(center).mul(aspect)
      const distance = length(toward)
      const outward = toward.div(max(distance, 1e-4))
      const crest = distance.sub(ring).div(0.07)
      const wave = exp(crest.mul(crest).negate()).mul(ringStrength)
      const bent = kicked.sub(outward.mul(wave).div(aspect))
      const split = outward.mul(aberration.mul(distance.min(1)).add(wave.mul(0.35))).div(aspect)
      const red = zoomSource.sample(bent.add(split).clamp(0, 1)).r
      const green = zoomSource.sample(bent.clamp(0, 1)).g
      const blue = zoomSource.sample(bent.sub(split).clamp(0, 1)).b
      current = mix(current, vec4(red, green, blue, 1), moving)
      const edge = smoothstep(float(0.26), float(0.78), length(screenUV.sub(0.5)))
      const vignette = uniform(0)
      set(vignette, 'vignette')
      current = current.mul(vec4(vec3(float(1).sub(edge.mul(vignette))), 1))
    }
    current = flood.compose(current)
    // The mood’s gradient map and the dither work on the image as it is shown, so the output transform comes before them.
    this.outputColorTransform = false
    current = gradeMood(renderOutput(current))
    if (heavy && settings.dither) {
      // Dithers by half an 8-bit step in display space, so the smooth, dark gradients of the sun shafts don’t band.
      current = vec4(current.rgb.add(interleavedGradientNoise(screenCoordinate.xy).sub(0.5).div(255)), current.a)
    }
    this.outputNode = current
  }

  override dispose() {
    super.dispose()
    for (const effect of this.effects.toReversed()) {
      effect.dispose()
    }
    this.effects.length = 0
  }
}
