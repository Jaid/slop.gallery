import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, float, mix, mx_atan2, mx_noise_float, normalLocal, normalWorld, positionGeometry, positionWorld, vec3} from 'three/tsl'

import {beads} from '../../lib/beads.ts'
import {glints} from '../../lib/glints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Six-rayed asterism centred where the half-vector meets the surface, so it glides as the viewer walks. */
function asterism(normal: Node<'vec3'>, view: Node<'vec3'>) {
  const N = normal.normalize()
  const L = vec3(-3, 9, -16).normalize()
  const H = view.add(L).normalize()
  const lift = H.sub(N.mul(H.dot(N)))
  const r = lift.length().max(0.0001)
  const axis = vec3(0.44, 0.77, 0.46).normalize()
  const across = N.cross(axis)
  const T = across.div(across.length().max(1e-6))
  const B = N.cross(T)
  const theta = mx_atan2(lift.dot(B), lift.dot(T)) as unknown as Node<'float'>
  const rays = theta.mul(3).cos().abs().pow(24)
  const halo = r.div(0.34).pow2().negate().exp()
  const core = halo.pow(4)
  const gate = N.dot(H).clamp().smoothstep(0.3, 0.7)
  return {
    core: core.mul(gate),
    rays: rays.mul(halo).add(core.mul(2.5)).mul(gate),
    spot: halo.mul(gate),
  }
}
/** Rutile needles along three lattice directions; `raw` stays derivative-free for vertex displacement. */
function needles(point: Node<'vec3'>) {
  const axes = [vec3(0.58, 0.58, 0.58).normalize(), vec3(-0.82, 0.36, 0.44).normalize(), vec3(0.2, -0.85, 0.5).normalize()]
  let band: Node<'float'> = float(0)
  let raw: Node<'float'> = float(0)
  for (const axis of axes) {
    const phase = point.dot(axis).mul(150)
    const cosine = phase.cos().mul(0.5).add(0.5)
    const visibility = phase.fwidth().smoothstep(0.6, 3).oneMinus()
    band = band.add(cosine.mul(visibility))
    raw = raw.add(cosine)
  }
  return {
    band: band.div(3),
    raw: raw.div(3),
  }
}

/** A star sapphire cut en cabochon: a deep blue stone shot through with rutile needles. Their three lattices braid into a six-rayed star that sits exactly where the light returns to your eye — so the star walks the stone as you walk the gallery, never quite still. Up close, the silk of the needles stands ready to flash. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const {p, grazing, near, intimate} = viewerFrame()
    const view = cameraPosition.sub(positionWorld).normalize()
    const star = asterism(normalWorld, view)
    const zoning = mx_noise_float(p.mul(1.8).add(4)).mul(0.5).add(0.5)
    const silk = needles(p)
    const grit = beads(p.mul(90).add(12), 33)
    const height = silk.raw.mul(intimate).mul(0.22).add(grit.core.mul(intimate).mul(0.3))
    this.positionNode = positionGeometry.add(normalLocal.mul(height.mul(0.0015)))
    this.normalNode = proceduralNormal(height, 0.25).add(normalLocal.mul(silk.band.sub(0.5).mul(intimate.mul(0.08)))).normalize()
    const deep = color(hsl.integer(266, 94, 18.6))
    const violet = color(hsl.integer(289, 82, 18))
    const body = mix(deep, violet, zoning).mul(float(0.75).add(silk.band.mul(0.2)))
    this.colorNode = body
    this.metalness = 0
    this.roughnessNode = float(0.06).add(silk.band.mul(0.05)).add(grit.mask.mul(0.08))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    this.ior = 1.765
    this.envMapIntensity = 1
    this.aoNode = grit.mask.mul(0.12).oneMinus()
    const jitter = vec3(mx_noise_float(p.mul(95)), mx_noise_float(p.mul(95).add(9)), mx_noise_float(p.mul(95).add(17))).sub(0.5)
    const needleFlash = glints(normalLocal, 70).mul(silk.band).mul(near).mul(0.6).add(star.spot.mul(silk.band).mul(0.8))
    const gritFlash = glints(normalLocal.add(jitter.mul(0.25)), 130).mul(grit.mask).mul(intimate)
    const fire = color(hsl.integer(260, 100, 95)).mul(star.rays.mul(3)).add(color(hsl.integer(0, 0, 100)).mul(star.core.mul(4)))
    this.emissiveNode = fire.add(body.mul(grazing.pow(3).mul(0.2))).add(color(hsl.integer(260, 99, 78)).mul(needleFlash)).add(color(hsl.integer(0, 0, 100)).mul(gritFlash.mul(0.6)))
  }
}
