import type {Node, Texture} from 'three/webgpu'

import {cameraPosition, color, float, mix, modelWorldMatrixInverse, mx_atan2, mx_noise_float, negateOnBackSide, positionGeometry, positionView, time, transformNormalToView, uv, varying, vec2, vec3, vec4} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

const grid: [number, number] = [48, 6]
/** Surface-gradient bump on an explicit base normal, for detail too fine to displace. */
function perturbNormal(base: Node<'vec3'>, height: Node<'float'>, strength: Node<'float'> | number) {
  const dx = positionView.dFdx()
  const dy = positionView.dFdy()
  const rx = dy.cross(base)
  const ry = base.cross(dx)
  const determinant = dx.dot(rx)
  const gradient = rx.mul(height.dFdx()).add(ry.mul(height.dFdy())).mul(determinant.sign()).div(determinant.abs().max(1e-12))
  return base.sub(gradient.mul(strength)).normalize()
}
/** One anemone polyp per lattice cell, kept whole inside its cell; the smooth dome carries the vertex-safe displacement while the tentacles live in the fragment normal. */
function polypField(tube: Node<'vec2'>) {
  const q = tube.mul(vec2(...grid))
  const wrapped = wrapCell(q.floor(), vec2(...grid))
  const rnd = cellNoiseVec3(vec3(wrapped, 7.3))
  const rnd2 = cellNoiseVec3(vec3(wrapped, 19.1))
  const local = q.fract().sub(rnd.xy.mul(0.12).add(0.44))
  const dist = local.length()
  const angle = mx_atan2(local.y, local.x.add(0.000001)) as unknown as Node<'float'>
  // Colonies grow by budding: a slow density field over the reef decides where
  // polyps crowd, where only buds venture, and where the mat stays bare.
  const cluster = mx_noise_float(positionGeometry.mul(2.3)).mul(0.5).add(0.5)
  const radius = rnd.z.mul(0.17).add(0.26).mul(cluster.mul(0.45).add(0.8)).min(0.43)
  const density = cluster.mul(0.7).add(rnd2.y.mul(0.3))
  const gate = rnd2.x.smoothstep(0.08, 0.2).mul(density.smoothstep(0.3, 0.42))
  const t = dist.div(radius).clamp()
  const dome = t.mul(t).oneMinus().max(0).sqrt()
  // Smooth crown envelopes; the tentacle ripple itself lives in the fragment normal.
  const ring = t.smoothstep(0.52, 0.78).mul(t.smoothstep(0.88, 1).oneMinus())
  const innerRing = t.smoothstep(0.26, 0.44).mul(t.smoothstep(0.58, 0.72).oneMinus())
  const tentacles = angle.mul(7).add(rnd.x.mul(TAU)).cos().mul(0.5).add(0.5).pow2()
  const mouthDip = t.smoothstep(0.1, 0.38).oneMinus()
  // The colony swells open for a near visitor and closes to jeweled buds from afar.
  const cameraLocal = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz
  const camDist = cameraLocal.sub(positionGeometry).length()
  const bloom = camDist.smoothstep(1.05, 4.4).oneMinus()
  const swell = bloom.mul(0.55).add(0.72)
  const breathe = time.mul(0.85).add(rnd.y.mul(TAU)).add(tube.x.mul(TAU * 1.5)).sin().mul(0.13).add(1)
  const sway = time.mul(1.35).add(rnd.x.mul(TAU)).sin().mul(0.3).add(0.85)
  const stalk = t.smoothstep(0.78, 0.98).oneMinus()
  const height = dome.pow(0.6).mul(0.014).add(stalk.mul(0.016)).add(ring.mul(0.004).mul(sway)).add(innerRing.mul(0.002)).add(ring.mul(tentacles).mul(0.005)).sub(mouthDip.mul(0.004)).mul(gate).mul(swell).mul(breathe).mul(radius.div(0.35))
  return {
    angle,
    bloom,
    cluster,
    dome,
    gate,
    height,
    innerRing,
    mouthDip,
    ring,
    rnd,
    rnd2,
    t,
    tentacles,
  }
}
function polypShape(tube: Node<'vec2'>) {
  const frame = knotFrame(tube)
  return frame.position.add(frame.normal.mul(polypField(tube).height))
}
/** A living anemone colony on a knot of dark reef flesh. Hundreds of polyps breathe, swell open as you approach, and pass a slow bioluminescent tide around the knot; their teal crowns catch a wet rim light while amber mouths glow at the center. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.6)
    this.name = knotData.id
    const tube = uv()
    const {p, facing, rim, near, intimate} = viewerFrame()
    this.positionNode = polypShape(tube)
    const eps = 0.00035
    const du = polypShape(tube.add(vec2(eps, 0))).sub(polypShape(tube.sub(vec2(eps, 0))))
    const dv = polypShape(tube.add(vec2(0, eps))).sub(polypShape(tube.sub(vec2(0, eps))))
    const displacedNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    const f = polypField(tube)
    // Tentacles: an angular ripple standing on the crown rings, plus fine radial
    // grooves — all fragment-carved, so they stay crisp at any mesh tessellation.
    const ripple = f.angle.mul(14).add(f.rnd.x.mul(TAU)).cos().mul(f.ring.mul(1).add(f.innerRing.mul(0.5)))
      .add(f.t.mul(16).sin().mul(f.ring.mul(0.3).add(f.innerRing.mul(0.2))))
      .sub(f.mouthDip.mul(0.5))
      .mul(f.gate)
    const polypNormal = perturbNormal(displacedNormal, ripple, 0.0038)
    this.normalNode = negateOnBackSide(polypNormal)
    this.clearcoatNormalNode = polypNormal
    const mask = f.t.smoothstep(0.94, 1).oneMinus().mul(f.gate).mul(f.gate.smoothstep(0.12, 0.45).mul(0.7).add(0.3))
    // The traveling tide is decided here so even the daylight color of a polyp
    // dims while it waits and brightens as the light reaches it.
    const wavePhase = tube.x.mul(TAU * 2).sub(time.mul(0.55)).add(f.rnd.z.mul(1.4))
    const wave = wavePhase.sin().mul(0.5).add(0.5).pow(6)
    const idle = time.mul(f.rnd2.y.mul(1.6).add(0.7)).add(f.rnd.x.mul(TAU)).sin().mul(0.22).add(0.78)
    const mottling = mx_noise_float(p.mul(6)).mul(0.5).add(0.5)
    const coralline = mx_noise_float(p.mul(3.5).add(7.7)).mul(0.5).add(0.5).smoothstep(0.45, 0.75)
    const tissue = mix(mix(color('#120722'), color('#33125e'), mottling.mul(0.85)), color('#4a2438'), coralline.mul(0.55))
    // Violet column rising through magenta into a living teal crown; the valleys
    // between tentacles fall into shadow so each finger stands apart.
    const valleyShade = f.tentacles.mul(0.35).add(0.65)
    let body = mix(mix(color('#2a0a4e'), color('#96297e'), f.dome.pow(1.6)), color('#17c898'), f.dome.pow(2.2)).mul(mix(float(1), valleyShade, f.ring.add(f.innerRing).clamp())).mul(wave.mul(0.55).add(0.45))
    body = mix(body, color('#8affdc'), f.ring.mul(f.tentacles).mul(0.45))
    const disc = f.t.smoothstep(0.1, 0.3).oneMinus().mul(f.gate)
    const softHalo = f.t.smoothstep(0.85, 1.35).oneMinus().mul(f.gate)
    // The bright crown lives only on the disc's top; the cushion's outer wall
    // stays dark reef flesh, so each polyp reads as emerging from the tissue.
    const crownMask = mask.mul(f.t.smoothstep(0.55, 0.85).oneMinus().mul(0.65).add(0.35))
    let albedo = mix(tissue, color('#2a1650'), softHalo.mul(0.55))
    albedo = mix(albedo, body, crownMask)
    albedo = mix(albedo, color('#e08a1e'), disc.mul(0.85))
    albedo = mix(albedo, color('#6e3405'), f.t.smoothstep(0.02, 0.13).oneMinus().mul(f.gate).mul(0.8))
    this.colorNode = albedo
    this.metalness = 0
    this.roughnessNode = mix(float(0.62), float(0.28), mask)
    this.clearcoat = 0.5
    this.clearcoatRoughness = 0.35
    this.sheenNode = color('#5a2a8a').mul(0.22)
    this.sheenRoughness = 0.65
    this.aoNode = mix(float(0.42), float(1), f.dome.mul(f.gate).mul(0.8).add(mask.mul(0.2))).mul(disc.mul(-0.35).add(1))
    const crown = f.ring.mul(f.tentacles).mul(0.9).add(f.innerRing.mul(f.tentacles).mul(0.4)).add(f.dome.pow(3).mul(0.5)).mul(f.gate)
    this.emissiveNode = color('#1fe8a8').mul(crown).mul(idle).mul(wave.mul(2.8).add(0.15)).mul(near.mul(0.4).add(0.9))
      .add(color('#ffb347').mul(disc).mul(wave.mul(1.1).add(0.5)).mul(idle))
      .add(color('#2fe8b0').mul(rim).mul(crown).mul(0.5))
      .add(color('#46ffd8').mul(crown).mul(intimate).mul(0.35))
      .add(color('#0f8f6a').mul(crown).mul(0.3))
      .add(color('#1c0b38').mul(mottling).mul(facing.mul(0.4).add(0.6)))
  }
}
