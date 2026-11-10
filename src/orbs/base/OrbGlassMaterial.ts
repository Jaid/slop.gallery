import type {TransmittingEmission} from '#src/lib/rendering/AlbedoRenderPipeline.ts'
import type {ColorRepresentation, Node} from 'three/webgpu'

import {Break, cameraFar, cameraNear, cameraPosition, cameraProjectionMatrix, float, Fn, frameId, If, interleavedGradientNoise, Loop, modelViewMatrix, modelWorldMatrixInverse, normalView, perspectiveDepthToViewZ, positionGeometry, positionView, positionViewDirection, reflect, refract, screenCoordinate, screenUV, select, smoothstep, vec2, vec3, vec4, viewportDepthTexture, viewportOpaqueMipTexture, viewportSafeUV} from 'three/tsl'
import {Color, MeshPhysicalNodeMaterial} from 'three/webgpu'

/** A ray through the orb’s fill, in its own frame and in radii of the orb, so the fill is the unit ball whichever size the orb is. */
export type OrbRay = {
  /** the ray’s direction through the fill, bent where it entered */
  direction: Node<'vec3'>
  /** the camera */
  eye: Node<'vec3'>
  /** 0–1, per pixel and frame, for offsetting samples so that the temporal antialiasing averages their banding away */
  jitter: Node<'float'>
  /** how far the ray runs through the fill to the glass on the far side */
  length: Node<'float'>
  /** where the ray enters the fill, on the unit sphere */
  origin: Node<'vec3'>
}

/** What the fill holds at a point of the ray. */
export type FillSample = {
  /** how much of the ray the liquid itself swallows per radius, adding no light of its own, like ink */
  absorption?: Node<'float'>
  /** the light the fill’s smoke or mist scatters toward the eye where it is dense, already lit */
  color: Node<'vec3'>
  /** how much of the ray the smoke or mist swallows per radius, scattering the light of `color` instead */
  density: Node<'float'>
  /** light the fill sends out per radius however dense it is, like a glowing spirit passing through the smoke */
  emission?: Node<'vec3'>
}

/** A thin thing in the fill that the ray crosses at one depth, like a bat’s wing or a ghost: it covers what lies behind it and may glow. */
export type FillLayer = {
  /** its color where it covers the ray, already lit */
  color: Node<'vec3'>
  /** 0–1, how much of the ray it covers */
  coverage: Node<'float'>
  /** how far along the ray it lies, in radii */
  depth: Node<'float'>
  /** light it sends out without covering anything, like a halo */
  glow?: Node<'vec3'>
}

/** What the ray brings out of the fill. */
export type OrbFill = {
  /** the light it gathered on the way */
  radiance: Node<'vec3'>
  /** 0–1, the share of the view behind the orb that makes it through */
  transmittance: Node<'float'>
}

export type OrbGlassOptions = {
  /** the orb’s radius in meters, which its geometry has */
  radius: number
}

/** refractive index of the glass shell */
const glassIor = 1.5
/** reflectance of the glass seen head-on */
const reflectance = ((glassIor - 1) / (glassIor + 1)) ** 2
/** what the glass reflects where the room behind the camera would be */
const unseenRoom = vec3(0.035, 0.018, 0.016)
/** Beyond this distance in meters between the orb and what lies behind it, the view through it stops bending further, so the room stays recognizable in it. */
const maximumGap = 4
/** the screen coordinates of a point in view space */
function project(point: Node<'vec3'>) {
  const clip = cameraProjectionMatrix.mul(vec4(point, 1))
  return clip.xy.div(clip.w).mul(vec2(0.5, -0.5)).add(0.5).clamp(0, 1)
}

/**
 * A thin glass globe filled with a liquid that a subclass paints by marching the view through it.
 *
 * The fill bends the view like water in a snow globe, so the room behind the orb shows through wherever the fill is thin, upside down and squeezed into the ball, the surest sign of glass. The glass reflects the room around the orb, which the frame already holds, and the lamps, which the lighting adds.
 *
 * Everything seen through the glass arrives as emission, so the orb itself is opaque: it writes depth, normals and motion like any solid, which the ambient occlusion and the temporal antialiasing need. It is drawn among the transparent objects only so that the room is already in the frame when it does.
 */
export default abstract class OrbGlassMaterial extends MeshPhysicalNodeMaterial implements TransmittingEmission {
  readonly emissionIsTransmission = true

  constructor({radius}: OrbGlassOptions, {fillIor = 1.33, name, tint = '#ffffff'}: {
    /** refractive index of the fill, which decides how strongly the orb bends the room behind it */
    fillIor?: number
    name: string
    /** the color the fill gives the room seen through it */
    tint?: ColorRepresentation
  }) {
    super({
      // A black body leaves only the reflections; everything inside comes in as emission.
      color: '#000000',
      metalness: 0,
      roughness: 0.03,
      ior: glassIor,
      specularIntensity: 1,
      transparent: true,
      opacity: 1,
    })
    this.name = name
    const fillTint = new Color(tint)
    this.emissiveNode = Fn(() => {
      const eye = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.div(radius).toVar('orbEye')
      const origin = positionGeometry.normalize().toVar('orbOrigin')
      const direction = refract(origin.sub(eye).normalize(), origin, 1 / fillIor).normalize().toVar('orbDirection')
      const length = origin.dot(direction).mul(-2).max(0).toVar('orbLength')
      // Golden-ratio steps from frame to frame spread the offsets evenly over the antialiasing’s history.
      const jitter = interleavedGradientNoise(screenCoordinate).add(float(frameId).mod(64).mul(0.618034)).fract().toVar('orbJitter')
      const fill = this.fill({
        origin,
        direction,
        length,
        eye,
        jitter,
      })
      const transmittance = fill.transmittance.toVar('orbFillTransmittance')
      // The ray leaves the fill bent once more, and keeps drifting until it meets whatever stands behind the orb.
      const exit = origin.add(direction.mul(length))
      const outgoing = refract(direction, exit.negate(), fillIor)
      const exitView = modelViewMatrix.mul(vec4(exit.mul(radius), 1)).xyz
      const outgoingView = modelViewMatrix.mul(vec4(outgoing, 0)).xyz.normalize()
      const backdropViewZ = perspectiveDepthToViewZ(viewportDepthTexture(screenUV), cameraNear, cameraFar)
      const gap = positionView.z.sub(backdropViewZ).clamp(radius * 2, maximumGap)
      // Light scattered by the fill blurs the view behind it.
      const blur = transmittance.oneMinus().mul(3).add(0.6)
      const backdrop = (viewportOpaqueMipTexture(viewportSafeUV(project(exitView.add(outgoingView.mul(gap)))), blur) as Node<'vec4'>).rgb
      // The fill scatters the brightest of it, like a lamp right behind the orb, into the glow around it, so the room seen through the orb never outshines what floats in it.
      const behind = backdrop.div(backdrop.r.max(backdrop.g).max(backdrop.b).mul(0.6).add(1))
      // The glass mirrors what stands around the orb, which the frame holds wherever the mirrored view lands on the screen. Toward the camera, it would mirror the unseen room behind it.
      const mirrored = reflect(positionView.normalize(), normalView)
      const mirroredClip = cameraProjectionMatrix.mul(vec4(positionView.add(mirrored.mul(gap)), 1))
      const mirroredUV = mirroredClip.xy.div(mirroredClip.w).mul(vec2(0.5, -0.5)).add(0.5)
      const onScreen = mirroredUV.sub(0.5).abs().max(0.5).sub(0.5).length().mul(-20).add(1).clamp().mul(select(mirroredClip.w.greaterThan(0), float(1), float(0)))
      const around = (viewportOpaqueMipTexture(viewportSafeUV(mirroredUV.clamp(0, 1)), float(1.5)) as Node<'vec4'>).rgb
      const room = unseenRoom.add(around.sub(unseenRoom).mul(onScreen.mul(smoothstep(0, -0.35, mirrored.z))))
      const cosine = normalView.dot(positionViewDirection).abs().clamp()
      const fresnel = float(reflectance).add(float(1 - reflectance).mul(cosine.oneMinus().pow(5)))
      return fill.radiance.add(behind.mul(vec3(fillTint.r, fillTint.g, fillTint.b)).mul(transmittance)).mul(fresnel.oneMinus()).add(room.mul(fresnel))
    })()
  }

  /** What the ray brings out of the fill. It runs inside a shader function, so it may loop. */
  protected abstract fill(ray: OrbRay): OrbFill

  /**
   * Marches the ray through the fill front to back in `steps` even steps: each sample covers what lies behind it by its density and adds its light as far as what lies in front of it lets through.
   * `layers` are crossed at their own depths between the samples. The march stops once nothing behind can show anymore.
   */
  protected march(ray: OrbRay, steps: number, sample: (point: Node<'vec3'>, depth: Node<'float'>) => FillSample, layers: Array<FillLayer> = []): OrbFill {
    const step = ray.length.div(steps).toVar('orbStep')
    const fixed = layers.map(layer => ({
      color: layer.color.toVar(),
      coverage: layer.coverage.clamp().toVar(),
      depth: layer.depth.toVar(),
      glow: layer.glow?.toVar(),
    }))
    const radiance = vec3(0).toVar('orbRadiance')
    const transmittance = float(1).toVar('orbTransmittance')
    Loop({
      start: 0,
      end: steps,
      type: 'int',
    }, ({i}) => {
      const near = float(i).mul(step)
      const far = near.add(step)
      for (const layer of fixed) {
        const crossed = select(layer.depth.greaterThanEqual(near).and(layer.depth.lessThan(far)), float(1), float(0))
        const covered = layer.coverage.mul(crossed)
        const light = layer.glow ? layer.color.mul(covered).add(layer.glow.mul(crossed)) : layer.color.mul(covered)
        radiance.addAssign(light.mul(transmittance))
        transmittance.mulAssign(covered.oneMinus())
      }
      const depth = float(i).add(ray.jitter).mul(step)
      const {absorption, color, density, emission} = sample(ray.origin.add(ray.direction.mul(depth)), depth)
      const scattering = density.max(0)
      const extinction = absorption ? scattering.add(absorption.max(0)).max(1e-4) : scattering.max(1e-4)
      const absorbed = extinction.mul(step).negate().exp().oneMinus()
      const scattered = absorption ? color.mul(absorbed.mul(scattering).div(extinction)) : color.mul(absorbed)
      const light = emission ? scattered.add(emission.mul(step)) : scattered
      radiance.addAssign(light.mul(transmittance))
      transmittance.mulAssign(absorbed.oneMinus())
      If(transmittance.lessThan(0.003), () => {
        Break()
      })
    })
    return {
      radiance,
      transmittance,
    }
  }
}
