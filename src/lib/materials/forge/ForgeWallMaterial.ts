import type {Node} from 'three/webgpu'

import {color, float, hash, max, mix, mx_noise_float, normalWorldGeometry, positionWorld, select, vec3} from 'three/tsl'
import {DoubleSide, MeshPhysicalNodeMaterial, MeshStandardNodeMaterial} from 'three/webgpu'

import forge, {forgeVestibule} from '#src/lib/gallery/forge.ts'

import {heightNormal, insideBy, visibleDetail} from '../filters.ts'

/** Returns the coverage, relief and color variation of a running bond in metric coordinates. */
export function runningBond(u: Node<'float'>, v: Node<'float'>, pitch: readonly [number, number], joint: number, bevel: number, footprint: Node<'float'>, wrap?: Node<'float'>) {
  const [width, height] = pitch
  const row = v.div(height).floor().toVar()
  const along = u.add(row.mod(2).mul(width / 2))
  const index = along.div(width).floor()
  const column = wrap ? index.sub(index.div(wrap).floor().mul(wrap)) : index
  const edge = float(0.5).sub(along.div(width).fract().sub(0.5).abs()).mul(width)
    .min(float(0.5).sub(v.div(height).fract().sub(0.5).abs()).mul(height)).toVar()
  return {
    face: insideBy(float(joint).sub(edge), footprint),
    relief: edge.smoothstep(joint, joint + bevel),
    tone: hash(row.mul(919).add(column).add(100_003)),
  }
}

/** Glazed petrol-blue trim around openings and along the floor and spring line. */
export class ForgeTrimMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super({
      color: '#294c50',
      roughness: 0.34,
      envMapIntensity: 0.75,
    })
    this.name = 'Forge molded faience'
    this.colorNode = color('#294c50').mul(mx_noise_float(positionWorld.mul(5)).mul(0.12).add(1))
  }
}

/** Salt-glazed blue tiles under pressed buff firebrick, mapped around straight walls or the round vestibule. */
export default class ForgeWallMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      roughness: 0.86,
      side: DoubleSide,
      clearcoat: 0.1,
      clearcoatRoughness: 0.25,
      envMapIntensity: 0.75,
    })
    this.name = 'Forge buff brick and glazed faience'
    const p = positionWorld.sub(vec3(forge.center[0], 0, forge.center[1]))
    const n = normalWorldGeometry
    const dz = positionWorld.z.sub(forgeVestibule.center[1])
    const round = p.z.lessThan(-forge.size[1] / 2 - 0.001).and(p.x.abs().lessThan(forgeVestibule.radius + 0.05))
    // Both modular courses divide into the nominal 18.9 m circumference, so the pattern joins across the angle wrap.
    const turn = p.x.atan(dz).mul(1 / (2 * Math.PI))
    const along = select(round, turn.mul(18.9), select(n.x.abs().greaterThan(0.7), p.z, p.x)).toVar('forgeWallAlong')
    const y = p.y.toVar('forgeWallY')
    const footprint = max(max(p.x.fwidth(), p.z.fwidth()), y.fwidth()).toVar('forgeWallFootprint')
    const grain = mx_noise_float(positionWorld.mul(68)).mul(visibleDetail(footprint, 0.02))
    const cloud = mx_noise_float(positionWorld.mul(3.5))
    const brick = runningBond(along, y.sub(1.16), [0.27, 0.095], 0.0055, 0.007, footprint, select(round, float(70), float(8192)))
    const clay = mix(color('#ac7e57'), color('#d4b793'), brick.tone.mul(0.74).add(0.23)).mul(cloud.mul(0.13).add(grain.mul(0.12)).add(1))
    const masonry = mix(color('#988577'), clay, brick.face)
    const tile = runningBond(along, y.sub(1.07), [0.3, 0.16], 0.0035, 0.009, footprint, select(round, float(63), float(8192)))
    const glaze = mix(color('#21464c'), color('#4c7981'), tile.tone.mul(0.72).add(cloud.mul(0.17)).add(0.14))
    const faience = mix(color('#263b3d'), glaze, tile.face)
    const dado = insideBy(y.sub(1.16), footprint)
    const bead = insideBy(y.sub(1.12).abs().sub(0.009), footprint)
    const top = insideBy(y.sub(1.115).abs().sub(0.045), footprint)
    const cap = mix(color('#25444b'), color('#a37344'), bead)
    this.colorNode = mix(mix(masonry, faience, dado), cap, top)
    this.roughnessNode = mix(float(0.87), float(0.34).add(tile.face.oneMinus().mul(0.48)), dado)
    this.clearcoatNode = dado.mul(tile.face).mul(0.32)
    this.normalNode = heightNormal(mix(brick.relief.mul(0.0036).add(grain.mul(0.00065)), tile.relief.mul(0.003).add(cloud.mul(0.00065)), dado).mul(visibleDetail(footprint, 0.045)))
  }
}
