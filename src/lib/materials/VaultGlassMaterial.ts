import type {TransmittingEmission} from '../rendering/AlbedoRenderPipeline.ts'
import type {Node} from 'three/webgpu'

import {cameraFar, cameraNear, cameraProjectionMatrix, color, float, fwidth, hash, max, mix, mx_noise_float, normalView, perspectiveDepthToViewZ, positionView, positionViewDirection, pow, screenUV, smoothstep, sqrt, uv, vec2, vec3, vec4} from 'three/tsl'
import {Color, MeshPhysicalNodeMaterial} from 'three/webgpu'

import GlassBackdrop from '../rendering/GlassBackdrop.ts'
import {heightNormal, visibleDetail} from './filters.ts'

export type VaultGlassOptions = {
  /** whether heavy refractive dispersion is active */
  heavy?: boolean
  /** size of one glass pane in meters along the arch and along the room */
  paneSize?: readonly [number, number]
  /** glass thickness in meters */
  thickness?: number
}

const ior = 1.52
const pillowHeight = 0.0028
const pillowWidth = 0.08
const hammered = {
  amplitude: 0.00075,
  frequency: 5.5,
}
const seeds = {
  amplitude: 0.00012,
  frequency: 26,
}
const jointHalfWidth = 0.0045
const maximumRefractionGap = 2.6
const dispersion = 0.032
/** Pale aqua-celadon iron body tint, lighter than the thick walk-on floor slabs so the blue sky shines clearly through. */
const attenuation = new Color('#b7e6df')
const attenuationColor = vec3(attenuation.r, attenuation.g, attenuation.b)
const attenuationDepth = 0.28

/**
 * Architectural cast conservatory glass for the Lobby’s barrel-vaulted skylights.
 *
 * Shares the physical cast-paver optics of {@link CastFloorGlassMaterial}: pillowed pane arrises, gentle hammered relief and
 * chromatic dispersion that refracts the opaque sky dome behind the vault, while catching warm specular highlights from the
 * chandeliers and interior environment.
 */
export default class VaultGlassMaterial extends MeshPhysicalNodeMaterial implements TransmittingEmission {
  readonly emissionIsTransmission = true

  constructor({heavy = true, paneSize = [1, 1], thickness = 0.04}: VaultGlassOptions = {}) {
    if (!(paneSize[0] > 0 && paneSize[1] > 0) || !(thickness > 0)) {
      throw new RangeError('VaultGlassMaterial requires positive pane dimensions and thickness.')
    }
    if (!heavy) {
      super({
        color: '#b8dce2',
        metalness: 0,
        roughness: 0.18,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        envMapIntensity: 0,
      })
      this.name = 'lobby-vault-glass-fast'
      return
    }
    super({
      color: '#000000',
      metalness: 0,
      roughness: 0.055,
      ior,
      specularIntensity: 1,
      specularColor: '#fff6e4',
      clearcoat: 0.35,
      clearcoatRoughness: 0.035,
      envMapIntensity: 1.1,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    })
    this.name = 'lobby-vault-glass-heavy'
    // Metric UV coordinates on the curved vault glass: u in meters along the arch, v in meters along z.
    const metric = uv()
    const footprint = max(fwidth(metric.x), fwidth(metric.y)).toVar('vaultGlassFootprint')
    const cell = metric.div(vec2(...paneSize)).floor().add(2048)
    const seed = hash(cell.x.add(cell.y.mul(4096))).mul(47)
    const local = metric.div(vec2(...paneSize)).fract().sub(0.5).abs()
    const edgeDistance = vec2(float(0.5).sub(local.x).mul(paneSize[0]), float(0.5).sub(local.y).mul(paneSize[1]))
    const joint = edgeDistance.x.min(edgeDistance.y).toVar('vaultGlassJoint')
    const antialias = max(fwidth(joint), 0.0005)
    const pane = smoothstep(float(jointHalfWidth).sub(antialias), float(jointHalfWidth).add(antialias), joint).toVar('vaultGlassPane')
    // Pillowed bevel around the perimeter of each pane plus gentle hammered and seed relief.
    const pillow = smoothstep(0, pillowWidth, joint).mul(pillowHeight)
    const hammer = mx_noise_float(vec3(metric.mul(hammered.frequency), seed)).mul(hammered.amplitude).mul(visibleDetail(footprint, 1 / hammered.frequency))
    const grain = mx_noise_float(vec3(metric.mul(seeds.frequency).add(seed), seed.add(17))).mul(seeds.amplitude).mul(visibleDetail(footprint, 1 / seeds.frequency))
    const totalHeight = pillow.add(hammer).add(grain).mul(pane)
    const flatNormal = normalView.normalize()
    const castNormal = heightNormal(totalHeight)
    this.normalNode = castNormal
    // Dark bronze-silicone joint bead between panes; amber-tinted border frame inside each pane’s perimeter.
    this.colorNode = mix(color('#1c1914'), color('#000000'), pane)
    this.roughnessNode = mix(float(0.55), float(0.055), pane)
    // Refract the opaque sky dome behind the glass with subtle prismatic dispersion and beveled edge bending.
    const scene = GlassBackdrop.forMaterial(this)
    const backdropViewZ = perspectiveDepthToViewZ(scene.depth.sample(screenUV), cameraNear, cameraFar)
    const gap = backdropViewZ.sub(positionView.z).negate().clamp(0, maximumRefractionGap)
    const backdrop = positionView.mul(backdropViewZ.div(positionView.z))
    const drift = castNormal.xy.sub(flatNormal.xy).mul(ior - 1).mul(gap)
    const sample = (spread: number) => {
      const clip = cameraProjectionMatrix.mul(vec4(backdrop.xy.add(drift.mul(1 + spread)), backdrop.z, 1))
      const sampleUV = clip.xy.div(clip.w).mul(vec2(0.5, -0.5)).add(0.5).clamp(0, 1)
      return scene.color.sample(scene.safeUV(sampleUV)) as Node<'vec4'>
    }
    const transmitted = vec3(sample(-dispersion).r, sample(0).g, sample(dispersion).b)
    const cosine = castNormal.dot(positionViewDirection).abs().clamp(0, 1)
    const reflectance = float(((ior - 1) / (ior + 1)) ** 2)
    const fresnel = reflectance.add(float(1).sub(reflectance).mul(float(1).sub(cosine).pow(5)))
    const refractedCosine = sqrt(float(1).sub(float(1).sub(cosine.mul(cosine)).div(ior * ior)))
    const bodyTint = pow(attenuationColor, vec3(float(thickness).div(refractedCosine.mul(attenuationDepth))))
    // Pillowed bevel catch + soft interior specular/Fresnel sheen so every pane visibly reads as real cast conservatory glass.
    const bevelBand = smoothstep(0.004, 0.032, joint).mul(float(1).sub(smoothstep(0.032, 0.11, joint)))
    const bevelGlow = color('#eaf6f2').mul(bevelBand.mul(0.095))
    const surfaceSheen = mix(color('#fff7e8'), color('#d6ece8'), float(1).sub(cosine)).mul(fresnel.mul(0.32).add(0.025))
    this.emissiveNode = transmitted.mul(bodyTint).mul(float(1).sub(fresnel.mul(0.75))).add(bevelGlow).add(surfaceSheen).mul(pane)
  }
}
