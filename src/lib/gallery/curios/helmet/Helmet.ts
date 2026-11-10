import type {Vec3} from '../../types.ts'
import type {LatticePoint} from '../lattice.ts'

import {DoubleSide, Float32BufferAttribute, Quaternion, SphereGeometry, Vector3} from 'three/webgpu'

import ForgedSteelMaterial from '#src/lib/materials/ForgedSteelMaterial.ts'
import {studioEnvironment} from '#src/lib/materials/metal.ts'

import {mergeParts} from '../../../geometry.ts'
import {lodgeSpurArmor} from '../../bastionNetwork.ts'
import {suitOfArmor} from '../../suitOfArmor.ts'
import Curio, {CurioModel} from '../base/Curio.ts'
import latticeGeometry from '../lattice.ts'

const degree = Math.PI / 180
/** the point inside the head the shell is laid out round, by polar angles from straight up and angles round from straight ahead */
const middle = [0, 0.205, 0] as const
/** how far the bare skull reaches from its middle sideways, up, forward and back */
const skull = {
  side: 0.112,
  up: 0.155,
  front: 0.128,
  back: 0.136,
}
/** the polar angle of the neck, where the shell ends inside the gorget */
const neck = 148
/** where the upper visor plate begins, standing proud of the skull, and how far */
const visorTop = 66
const visorRaise = 0.0035
/** the band of the lower visor, the ventail, which stands prouder still, and how far */
const ventail = [84.5, 118] as const
const ventailRaise = 0.007
/** how far round from straight ahead both visor plates reach to either side, to where they pivot */
const visorSpan = 78
/** the eye slits: the band they cut through the upper visor, and how far round from straight ahead each reaches, the bar between them in the middle */
const eyeBand = [76, 81.5] as const
const eyeSpan = [4, 52] as const
/** the slots in the ventail to breathe through: the band they cut, where round each is and how wide it is */
const slotBand = [92, 110] as const
const slots = [-31.5, -22.5, -13.5, -4.5, 4.5, 13.5, 22.5, 31.5] as const
const slotWidth = 3.6
/** how deep a slit or slot cuts in, standing for a hole through the steel */
const holeDepth = 0.009
/** how far the creased prow of the visor stands forward at most */
const prowReach = 0.022
/** the gorget: how high its top lies inside the helmet’s chin and how far it reaches there, and how far its border reaches at the sides, before its points at the front and back */
const gorgetTop = [0.112, 0.084] as const
const gorgetBorder = 0.158
/** how tiny a step is taken either side of an edge, in degrees, so the edge stands crisp */
const edgeStep = 0.06
const smoothstep = (from: number, to: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)))
  return t * t * (3 - 2 * t)
}
/** How far the border of the gorget, which the helmet stands on, reaches from its axis at `theta` degrees round from straight ahead. */
export function gorgetBorderReach(theta: number) {
  const [x, , z] = gorget(theta, 1)
  return Math.hypot(x, z)
}
/** Where the shell’s surface lies at `theta` degrees round from straight ahead and `phi` degrees down from straight up, and how far there it lies in a hole. */
function shell(theta: number, phi: number) {
  const [t, p] = [theta * degree, phi * degree]
  const direction = [Math.sin(p) * Math.sin(t), Math.cos(p), Math.sin(p) * Math.cos(t)] as const
  const [dx, dy, dz] = direction
  const depth = dz > 0 ? skull.front : skull.back
  const bare = 1 / Math.hypot(dx / skull.side, dy / skull.up, dz / depth)
  // A low comb along the crown, from the brow over to the nape
  const comb = 0.006 * Math.exp(-((bare * Math.abs(dx) / 0.011) ** 2)) * smoothstep(0.1, 0.55, dy)
  const ahead = Math.cos(t) > 0 && Math.abs(theta) < visorSpan
  let raise = 0
  if (ahead && phi >= visorTop && phi < ventail[0]) {
    raise = visorRaise
  } else if (ahead && phi >= ventail[0] && phi < ventail[1]) {
    raise = ventailRaise
  }
  // The visor’s prow, creased straight down its middle, from the eyes down over the slots to the chin
  const prow = Math.cos(t) > 0 ? prowReach * smoothstep(70, 95, phi) * (1 - smoothstep(122, 146, phi)) * Math.max(0, 1 - Math.abs(Math.sin(t)) / Math.sin(62 * degree)) ** 1.6 : 0
  const eye = ahead && phi > eyeBand[0] && phi < eyeBand[1] && Math.abs(theta) > eyeSpan[0] && Math.abs(theta) < eyeSpan[1]
  const slot = phi > slotBand[0] && phi < slotBand[1] && slots.some(at => Math.abs(theta - at) < slotWidth / 2)
  const hole = eye || slot ? 1 : 0
  const reach = bare + comb + raise + prow - hole * holeDepth
  return {
    position: [middle[0] + dx * reach, middle[1] + dy * reach, middle[2] + dz * reach] as Vec3,
    hole,
  }
}
/** Where the gorget’s surface lies at `theta` degrees round from straight ahead, the share `t` of the way down from its top to its border. */
function gorget(theta: number, t: number): Vec3 {
  const angle = theta * degree
  // Pointed at the front, and a little at the back
  const point = Math.max(0, 1 - Math.abs(Math.sin(angle)) / Math.sin(48 * degree)) ** 2 * (Math.cos(angle) > 0 ? 0.03 : 0.012)
  const [top, reach] = gorgetTop
  // flaring out like a bell, with a rolled border along its edge
  const r = reach + (gorgetBorder + point - reach) * t ** 1.7 + 0.0035 * Math.exp(-(((t - 0.93) / 0.025) ** 2))
  return [r * Math.sin(angle), top * (1 - t), r * Math.cos(angle)]
}
/** Samples from `from` to `to` every `step`, ending on `to`, and either side of every edge, without any sample crowding an edge. */
function samples(from: number, to: number, step: number, edges: ReadonlyArray<number>) {
  const count = Math.floor((to - from) / step + 1e-9)
  const uniform = [...Array.from({length: count + 1}, (_, index) => from + index * step).filter(value => value < to - step / 3), to]
  const sides = edges.flatMap(edge => [edge - edgeStep, edge + edgeStep])
  return [...uniform.filter(value => edges.every(edge => Math.abs(value - edge) > edgeStep * 2)), ...sides].toSorted((a, b) => a - b)
}
/** The outward normal of a surface at a point, by its tangents round and down there. */
function outward(surface: (round: number, down: number) => Vec3, round: number, down: number, step: number) {
  const at = (r: number, d: number) => new Vector3(...surface(r, d))
  const across = at(round + step, down).sub(at(round - step, down))
  const along = at(round, down + step).sub(at(round, down - step))
  return along.cross(across).normalize()
}
/** Rivet heads, low domes on the surface at the points, facing out along its normals. */
function rivetHeads(points: ReadonlyArray<{
  normal: Vector3
  position: Vec3
}>, radius: number) {
  const up = new Vector3(0, 1, 0)
  const turn = new Quaternion
  return points.map(({normal, position}) => {
    const head = new SphereGeometry(radius, 6, 2, 0, Math.PI * 2, 0, Math.PI / 2)
    head.deleteAttribute('uv')
    head.scale(1, 0.5, 1).applyQuaternion(turn.setFromUnitVectors(up, normal)).translate(...position)
    const mask = Float32Array.from({length: head.getAttribute('position').count * 2}, (_, index) => (index % 2 ? 0.5 : 0))
    head.setAttribute('steelMask', new Float32BufferAttribute(mask, 2))
    return head
  })
}
/**
 * A knight’s close helmet of hand-forged steel, and nobody in it: an egg of a skull with a low comb over its crown, a visor of two plates standing proud of it, the upper one with its eye slits, the lower one creased down its prow and slotted to breathe through, a pointed chin, all on a bell of a gorget with a rolled border riveted all round, pointed at the front.
 * It rests on the shoulders of the empty suit of armor at the end of the Bastion’s blind branch beside the Lodge, looking back with it toward the entrance, and steers the flavor the Forge’s alchemy machine gives a Transparent Orb to a Spook Orb.
 * In its own frame it stands on the border of its gorget at the origin, looking along z.
 */
export default class Helmet extends Curio {
  readonly id = 'helmet'
  readonly mass = 3.2
  readonly position: Vec3 = [lodgeSpurArmor[0], lodgeSpurArmor[1] + suitOfArmor.collar + 0.001, lodgeSpurArmor[2]]
  readonly reach = 0.36
  readonly room = 'bastion'
  readonly title = 'A knight’s helmet, with nobody in it'

  createModel() {
    const visorEdges = [visorSpan, eyeSpan[0], eyeSpan[1], ...slots.flatMap(at => [at - slotWidth / 2, at + slotWidth / 2])]
    const thetas = samples(-180, 175, 5, [...new Set([...visorEdges, ...visorEdges.map(edge => -edge)])])
    const phis = samples(2, neck, 3.5, [visorTop, ...eyeBand, ...ventail, ...slotBand])
    const polish = 0.12
    const shellGeometry = latticeGeometry(phis.map(phi => thetas.map((theta): LatticePoint => {
      const {position, hole} = shell(theta, phi)
      return {
        position,
        values: [hole, polish],
      }
    })), {
      start: {
        position: shell(0, 0).position,
        values: [0, polish],
      },
      extra: {
        name: 'steelMask',
        size: 2,
      },
    })
    const gorgetRows = 12
    const gorgetThetas = Array.from({length: 72}, (_, index) => -180 + index * 5)
    const gorgetGeometry = latticeGeometry(Array.from({length: gorgetRows}, (_, row) => gorgetThetas.map((theta): LatticePoint => ({
      position: gorget(theta, row / (gorgetRows - 1)),
      values: [0, 0.08],
    }))), {
      extra: {
        name: 'steelMask',
        size: 2,
      },
    })
    const shellAt = (theta: number, phi: number) => shell(theta, phi).position
    // The visor’s pivots on either side and a rivet above and below each, and a row round the gorget inside its border
    const skullRivets = [-1, 1].flatMap(side => [70, 87, 104].map(phi => ({
      position: shellAt(side * (visorSpan + 3), phi),
      normal: outward(shellAt, side * (visorSpan + 3), phi, 0.5),
    })))
    const gorgetRivets = Array.from({length: 30}, (_, index) => {
      const theta = -180 + index * 12 + 6
      return {
        position: gorget(theta, 0.85),
        normal: outward((round, down) => gorget(round, down), theta, 0.85, 0.01),
      }
    })
    const steel = mergeParts([shellGeometry, gorgetGeometry, ...rivetHeads(skullRivets, 0.0065), ...rivetHeads(gorgetRivets, 0.0042)])
    const material = new ForgedSteelMaterial({
      environment: studioEnvironment,
      patina: 0.15,
    })
    // Seen from below, the gorget and the shell show their insides.
    material.side = DoubleSide
    return new CurioModel([
      {
        name: 'helmet-steel',
        geometry: steel,
        material,
      },
    ])
  }
}
