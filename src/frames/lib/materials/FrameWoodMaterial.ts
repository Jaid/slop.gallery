import type {Node} from 'three/webgpu'

import {clamp, color, float, max, mix, mx_fractal_noise_float, mx_noise_float, mx_worley_noise_float, select, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal, visibleDetail} from '#src/lib/materials/filters.ts'

import {frameSurface} from './frameAttributes.ts'
import frameStudio from './frameStudio.ts'

/** what a timber looks like: its colors, how its rings and pores run and what figure it shows */
export type Timber = {
  /** the swirling eyes and curls of burl, 0 to 1 */
  burl?: number
  /** late wood, the darker part */
  dark: string
  /** dark knots of a softwood, 0 to 1 */
  knots?: number
  /** early wood, the lighter part of a growth ring */
  light: string
  /** how strongly the pores stipple the surface, 0 to 1 */
  pores: number
  /** the silvery flecks of the medullary rays of quartersawn oak, 0 to 1 */
  rays?: number
  /** the thin lines between the rings */
  ring: string
  /** rings per meter across the grain */
  rings: number
}

type Float = Node<'float'>

export const walnut: Timber = {
  light: '#6a4428',
  dark: '#3a2414',
  ring: '#22130a',
  rings: 140,
  pores: 0.6,
}
export const oak: Timber = {
  light: '#b08955',
  dark: '#8a6535',
  ring: '#5e4022',
  rings: 110,
  pores: 0.8,
  rays: 0.8,
}
export const ebony: Timber = {
  light: '#1d1714',
  dark: '#0d0a08',
  ring: '#050403',
  rings: 220,
  pores: 0.15,
}
export const pine: Timber = {
  light: '#d2a774',
  dark: '#b07f48',
  ring: '#7d4f25',
  rings: 45,
  pores: 0.2,
  knots: 0.7,
}
export const burlWalnut: Timber = {
  light: '#8a5a30',
  dark: '#4a2c14',
  ring: '#26150a',
  rings: 160,
  pores: 0.4,
  burl: 1,
}
export const hinoki: Timber = {
  light: '#e6cfa6',
  dark: '#d2b583',
  ring: '#b8935e',
  rings: 160,
  pores: 0.1,
}
export type FrameWoodOptions = {
  /** a clear coat over the wood, 0 for an oiled, satin surface and up to 1 for a high French polish */
  gloss?: number
  /** how much the hollows have darkened with old wax and dust, 0 to 1 */
  grime?: number
  /** carving or turning cut into the wood, in meters of height over the surface */
  relief?: (surface: ReturnType<typeof frameSurface>) => Float
  /** how rough the finish is */
  roughness?: number
  /** how much light reaches the wood, 1 everywhere by default, less in gaps and shadows painted in, like between slats */
  shade?: (surface: ReturnType<typeof frameSurface>) => Float
  /** a stain over the timber, multiplying its color, white for none */
  stain?: string
  timber: Timber
}

/**
 * Wood for frames, its grain running along every member and meeting itself in the miters, as joiners cut them; ornaments carry their own grain along their x. Rings, pores, the rays of quartersawn oak, burl and knots are all procedural and fade to their average before they could shimmer.
 */
export default class FrameWoodMaterial extends MeshPhysicalNodeMaterial {
  constructor({gloss = 0, grime = 0.4, relief, roughness = 0.5, shade, stain = '#ffffff', timber}: FrameWoodOptions) {
    super({
      roughness,
      envMap: frameStudio,
      envMapIntensity: 0.7,
      clearcoat: gloss,
      clearcoatRoughness: 0.08,
    })
    const surface = frameSurface()
    const p = surface.position
    // Along the member, and through its section, from its sight edge outward and from its back forward.
    const along = surface.along.toVar('woodAlong')
    const depth = select(surface.isOrnament.greaterThan(0.5), surface.across, surface.reach.add(p.z.mul(0.6))).toVar('woodDepth')
    const seed = surface.member.mul(7.13).add(1.7)
    const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth()).toVar('woodFootprint')
    const meander = mx_noise_float(vec3(along.mul(1.1), depth.mul(6), seed)).mul(5).add(mx_noise_float(vec3(along.mul(4), depth.mul(20), seed.add(3))).mul(0.8))
    let ringPhase: Float = depth.mul(timber.rings).add(meander)
    let burl: Float = float(0)
    if (timber.burl) {
      // Burl grows in clusters of eyes, each warping the rings round it.
      const warp = mx_fractal_noise_float(vec3(along.mul(16), depth.mul(16), seed.add(9)), 4).toVar('woodBurlWarp')
      const eyes = mx_worley_noise_float(vec3(along.mul(26), depth.mul(26), seed).add(warp.mul(0.6))).toVar('woodEyes')
      burl = eyes.smoothstep(0, 0.1).oneMinus().mul(timber.burl)
      ringPhase = ringPhase.add(warp.mul(22 * timber.burl)).add(eyes.mul(12 * timber.burl))
    }
    const ringFade = ringPhase.fwidth().smoothstep(0.8, 2.4)
    const rings = mix(ringPhase.sin().mul(0.5).add(0.5).pow(3), float(0.25), ringFade).toVar('woodRings')
    const porePhase = depth.mul(520)
    const pores = mix(mx_noise_float(vec3(along.mul(7), porePhase, seed.add(11))).mul(0.5).add(0.5), float(0.5), porePhase.fwidth().smoothstep(0.6, 2)).mul(timber.pores)
    const figure = mx_noise_float(vec3(along.mul(1.4), depth.mul(9), seed.add(5))).mul(0.5).add(0.5)
    let flecks: Float = float(0)
    if (timber.rays) {
      // Rays cut across the rings as short, glossy ribbons stretched along the grain.
      flecks = mx_worley_noise_float(vec3(along.mul(9), depth.mul(160), seed.add(21))).smoothstep(0, 0.22).oneMinus().mul(visibleDetail(footprint, 0.006)).mul(timber.rays)
    }
    let knots: Float = float(0)
    if (timber.knots) {
      const knot = mx_worley_noise_float(vec3(along.mul(3.2), depth.mul(12), seed.add(31)))
      knots = knot.smoothstep(0.02, 0.09).oneMinus().mul(mx_noise_float(vec3(seed, 4.1, 2)).mul(0.5).add(0.5).smoothstep(0.2, 0.6)).mul(timber.knots)
    }
    const tone = surface.piece.mul(0.12).add(0.94)
    const timberColor = mix(color(timber.dark), color(timber.light), clamp(figure.mul(0.7).add(surface.piece.mul(0.2)).add(burl.mul(0.25)), 0, 1))
    const ringed = mix(timberColor, color(timber.ring), rings.mul(0.55).add(burl.mul(0.3)))
    const flecked = mix(ringed, color(timber.light).mul(1.15), flecks.mul(0.45))
    const knotted = mix(flecked, color(timber.ring).mul(0.7), knots)
    const hollow = surface.cavity.smoothstep(0.1, 0.8)
    this.colorNode = knotted.mul(pores.mul(-0.25).add(1)).mul(tone).mul(color(stain)).mul(float(1).sub(hollow.mul(grime * 0.45))).mul(shade?.(surface) ?? float(1))
    this.roughnessNode = float(roughness).add(pores.mul(0.12)).sub(flecks.mul(0.15)).add(hollow.mul(grime * 0.2))
    this.normalNode = heightNormal(pores.mul(-0.00012).sub(rings.mul(0.00005)).mul(visibleDetail(footprint, 0.003)).add(relief?.(surface) ?? float(0)))
  }
}
