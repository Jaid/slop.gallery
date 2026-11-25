import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, Fn, If, int, Loop, mix, mx_fractal_noise_float, mx_noise_float, mx_noise_vec3, vec3, vec4} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

type LoopParams = {
  condition: string
  end: Node<'int'>
  name: string
  start: number
}
type LoopBody = (inputs: Record<string, LoopNodeInput>) => void
type LoopNodeInput = Node<'int'>
// Three.js ships loop types that only cover two levels and omit the variable name, so the
// runtime signature is reached through a narrow cast instead of duplicating the loop by hand.
const loop = Loop as unknown as (params: LoopParams, body: LoopBody) => void
/** Jittered 3D Voronoi, packed as `(distance, cellIdentity)`. Returns the distance to the nearest feature point together with the identity of the owning cell, so every organic domain can carry its own random properties. Unlike the raw cell-noise lattice this produces irregular blobs instead of axis-aligned cubes. The loop must live inside an `Fn` so its statements reach a stack. */
const voronoiDomainPacked = Fn(([position]: [Node<'vec3'>]) => {
  const p = vec3(position).toVar()
  const base = p.floor()
  const local = p.fract()
  const nearest = float(1e6).toVar()
  const owner = vec3(0).toVar()
  loop({
    start: -1,
    end: int(1),
    name: 'x',
    condition: '<=',
  }, ({x}) => {
    loop({
      start: -1,
      end: int(1),
      name: 'y',
      condition: '<=',
    }, ({y}) => {
      loop({
        start: -1,
        end: int(1),
        name: 'z',
        condition: '<=',
      }, ({z}) => {
        const offset = vec3(x, y, z)
        const cell = base.add(offset)
        const point = offset.add(cellNoiseVec3(cell))
        const distance = local.sub(point).length()
        If(distance.lessThan(nearest), () => {
          nearest.assign(distance)
          owner.assign(cell)
        })
      })
    })
  })
  return vec4(nearest, cellNoiseVec3(owner))
})
function voronoiDomain(position: Node<'vec3'>) {
  const packed = voronoiDomainPacked(position)
  return {
    distance: packed.x,
    id: packed.yzw,
  }
}
/** Narrow-band spectral response: t = 0 is deep red, t = 1 is violet. */
const spectral = (t: Node<'float'>) => vec3(t.sub(0.05).div(0.2).pow(2).negate().exp(), t.sub(0.42).div(0.17).pow(2).negate().exp(), t.sub(0.82).div(0.22).pow(2).negate().exp())
/** The studio's two brightest sources, in object space. */
const lamps = [vec3(-0.16, 0.48, -0.86).normalize(), vec3(0.34, 0.52, 0.78).normalize()]
/** Precious opal. Amorphous silica is secretly ordered: microscopic spheres stack into irregular domains, and each domain diffracts one wavelength toward the eye. Grating orientation and sphere spacing are random per domain, so neighbouring patches ignite in unrelated colors and the whole stone re-lights itself as you walk around it. Fire only survives inside a few pockets of ordered silica; the rest is potch. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.45)
    this.name = knotData.id
    const {p, view, grazing, near} = viewerFrame()
// Grating equation: the diffracted wavelength is the sphere spacing times the sum of the
// sines of the incident and emergent angles. Only a narrow band is visible at all, so most
// domains stay dark potch and only a scattered few ignite.
    const diffraction = (identity: Node<'vec3'>) => {
      const grating = identity.sub(0.5).mul(2).normalize()
      const spacing = identity.z.mul(0.42).add(0.28)
      let fire: Node<'vec3'> = vec3(0)
      let lit: Node<'float'> = float(0)
      for (const lamp of lamps) {
        const sum = lamp.dot(grating).abs().add(view.dot(grating).abs())
        const lambda = spacing.mul(sum)
        const visible = lambda.smoothstep(0.47, 0.51).mul(lambda.smoothstep(0.65, 0.6))
        const tint = spectral(float(0.65).sub(lambda).div(0.18))
        fire = fire.add(tint.mul(visible))
        lit = lit.add(visible)
      }
      return {
        fire,
        lit,
      }
    }
// Warp the lattice so the ordered domains are organic blobs, not cubes.
    const warp = mx_noise_vec3(p.mul(2.4)).mul(0.75)
    const surfaceDomain = voronoiDomain(p.mul(16).add(warp))
    const surface = diffraction(surfaceDomain.id)
    const depth = diffraction(voronoiDomain(p.sub(view.mul(0.055)).mul(29).add(21.7)).id)
// Ordered silica only survives in pockets; everything else is dead potch.
    const pocket = mx_fractal_noise_float(p.mul(2.4), 3, 2, 0.5).mul(0.5).add(0.5)
    const pocketMask = pocket.smoothstep(0.5, 0.74)
// Fire blooms from the middle of each domain and dies out at its rim, so the patches
// glow like suspended silica rather than reading as cut-out shards.
    const bloom = surfaceDomain.distance.smoothstep(0, 0.55).oneMinus()
    const flash = surface.lit.clamp().mul(pocketMask).mul(bloom)
    const deepFlash = depth.lit.clamp().mul(pocketMask).mul(0.5)
// Deep smoky potch with a whisper of milky common opal.
    const turbid = mx_noise_float(p.mul(3.4).add(11.3)).smoothstep(0.6, 0.95)
    const grain = mx_noise_float(p.mul(7.5)).mul(0.5).add(0.5)
    const potch = mix(mix(color(hsl.integer(282, 42, 2)), color(hsl.integer(284, 24, 5)), grain), color(hsl.integer(293, 31, 11)), turbid.mul(0.14))
// Pinfire: round inclusions that ignite one at a time as the eye moves.
    const facet = mx_noise_vec3(p.mul(58)).normalize()
    const half = view.add(lamps[0]).normalize()
    const glint = facet.dot(half).clamp().pow(12)
    const speck = cellularPoints(p.mul(58), 0.03, 0.17, 0.42)
    const sparkle = glint.mul(speck).mul(pocketMask)
// A little of the fire bleeds into the surrounding potch, as light does in real silica.
    const bleed = surface.fire.mul(surface.lit.clamp()).mul(pocketMask).mul(0.16)
    this.colorNode = potch.add(surface.fire.mul(flash).mul(0.6)).add(depth.fire.mul(deepFlash).mul(0.3)).add(bleed)
    this.metalness = 0
    this.roughnessNode = float(0.04).add(turbid.mul(0.04)).add(flash.mul(0.03))
    this.ior = 1.45
    this.clearcoat = 0.55
    this.clearcoatRoughness = 0.02
    this.normalNode = proceduralNormal(grain.mul(0.05), 0.00025)
    this.clearcoatNormalNode = this.normalNode
    this.emissiveNode = surface.fire.mul(flash).mul(near.mul(0.2).add(0.8)).mul(1.9)
      .add(depth.fire.mul(deepFlash).mul(near.mul(0.2).add(0.8)).mul(0.9))
      .add(color(hsl.integer(0, 0, 100)).mul(sparkle).mul(near.mul(0.4).add(0.6)).mul(0.5))
      .add(color(hsl.integer(289, 68, 13)).mul(grazing.pow(3)).mul(0.04))
  }
}
