import type {Vec3} from '../../types.ts'
import type {LatticePoint} from '../lattice.ts'

import {DoubleSide, Vector3} from 'three/webgpu'

import ForgedSteelMaterial from '#src/lib/materials/ForgedSteelMaterial.ts'
import {studioEnvironment} from '#src/lib/materials/metal.ts'
import {spookOrb} from '#src/orbs/index.ts'

import {mergeParts} from '../../../geometry.ts'
import {rivetHeads, sheetGeometry, smoothstep, steelMask} from '../../armor/plating.ts'
import {lodgeSpurArmor} from '../../bastionNetwork.ts'
import {suitOfArmor} from '../../suitOfArmor.ts'
import Curio, {CurioModel} from '../base/Curio.ts'
import latticeGeometry from '../lattice.ts'

const degree = Math.PI / 180
/** how tall it stands, from the border of its gorget to the top of its comb */
export const helmetHeight = 0.4
/** the point inside the head the shell is laid out round, by polar angles from straight up and angles round from straight ahead */
const middle = [0, 0.229, 0] as const
/** how far the bare skull reaches from its middle sideways, up, forward and back */
const skull = {
  side: 0.121,
  up: 0.159,
  front: 0.136,
  back: 0.146,
}
/** how high the comb along the crown stands at most, and how wide it is */
const comb = {
  width: 0.0075,
  height: helmetHeight - middle[1] - skull.up,
}
/** the polar angle of the neck, where the shell ends inside the gorget */
const neck = 148
/** the brow reinforce over the visor: where it begins, standing proud of the skull, and how far */
const browTop = 50
const browRaise = 0.0025
/** where the upper visor plate begins, standing prouder, and how far */
const visorTop = 64
const visorRaise = 0.005
/** the band of the lower visor, the ventail, which stands prouder still, and how far */
const ventail = [83, 120] as const
const ventailRaise = 0.0095
/** how far round from straight ahead the brow reinforce and both visor plates reach to either side, to where the visor pivots */
const visorSpan = 80
/** the sight: the band it cuts through the upper visor, and how far round from straight ahead each half reaches, the bar between them in the middle */
const sightBand = [74.5, 79.5] as const
const sightSpan = [4.5, 56] as const
/** the breaths in the ventail either side of its prow: the band they cut, where round each is and how wide it is */
const breathBand = [91, 109] as const
const breaths = [-18, -26, -34, -42, -50, 18, 26, 34, 42, 50] as const
const breathWidth = 3.4
/** how far the creased prow of the visor, a sparrow’s beak, stands forward at most */
const prowReach = 0.034
/** the gorget of two lames: how high its top lies inside the helmet’s chin and how far it reaches there, where its lower lame begins, and how far its border reaches at the sides, before its points at the front and back */
const gorgetTop = [0.122, 0.092] as const
const gorgetLame = 0.46
const gorgetBorder = 0.166
/** how tiny a step is taken either side of an edge, in degrees, so the edge stands crisp */
const edgeStep = 0.06
/** How far the border of the gorget, which the helmet stands on, reaches from its axis at `theta` degrees round from straight ahead. */
export function gorgetBorderReach(theta: number) {
  const [x, , z] = gorget(theta, 1)
  return Math.hypot(x, z)
}
/** Where the shell’s surface lies at `theta` degrees round from straight ahead and `phi` degrees down from straight up. */
function shell(theta: number, phi: number): Vec3 {
  const [t, p] = [theta * degree, phi * degree]
  const [dx, dy, dz] = [Math.sin(p) * Math.sin(t), Math.cos(p), Math.sin(p) * Math.cos(t)]
  const depth = dz > 0 ? skull.front : skull.back
  const bare = 1 / Math.hypot(dx / skull.side, dy / skull.up, dz / depth)
  // A tall, sharp comb along the crown, from the brow over to the nape
  const lateral = bare * Math.abs(dx)
  const combRise = comb.height * Math.exp(-((lateral / comb.width) ** 2)) * smoothstep(0.05, 0.6, dy)
  const ahead = Math.cos(t) > 0 && Math.abs(theta) < visorSpan
  let raise = 0
  if (ahead && phi >= browTop && phi < visorTop) {
    raise = browRaise
  } else if (ahead && phi >= visorTop && phi < ventail[0]) {
    raise = visorRaise
  } else if (ahead && phi >= ventail[0] && phi < ventail[1]) {
    raise = ventailRaise
  }
  // The visor’s prow, creased sharply down its middle, from the sight down over the breaths to the chin
  const prow = Math.cos(t) > 0 ? prowReach * smoothstep(68, 96, phi) * (1 - smoothstep(118, 146, phi)) * Math.max(0, 1 - Math.abs(Math.sin(t)) / Math.sin(58 * degree)) ** 2.2 : 0
  const reach = bare + combRise + raise + prow
  return [middle[0] + dx * reach, middle[1] + dy * reach, middle[2] + dz * reach]
}
/** Where the gorget’s surface lies at `theta` degrees round from straight ahead, the share `t` of the way down from its top to its border. */
function gorget(theta: number, t: number): Vec3 {
  const angle = theta * degree
  // Pointed at the front, and a little at the back
  const point = Math.max(0, 1 - Math.abs(Math.sin(angle)) / Math.sin(46 * degree)) ** 2 * (Math.cos(angle) > 0 ? 0.03 : 0.012)
  const [top, reach] = gorgetTop
  // flaring out like a bell, the upper lame lapping over the lower one, with a rolled border along its edge
  const lap = t < gorgetLame ? 0.0055 * t / gorgetLame : 0
  const r = reach + (gorgetBorder + point - reach) * t ** 1.6 + lap + 0.004 * Math.exp(-(((t - 0.94) / 0.024) ** 2))
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
/** A hole through the visor, from `thetas[0]` to its last and `phis[0]` to its last, as the dark inside a hair over the steel, see `ForgedSteelMaterial`. */
function opening(thetas: ReadonlyArray<number>, phis: ReadonlyArray<number>) {
  return sheetGeometry(phis.map(phi => thetas.map((theta): LatticePoint => {
    const point = new Vector3(...shell(theta, phi))
    const normal = outward(shell, theta, phi, 0.2)
    point.addScaledVector(normal, 0.0006)
    return {
      position: point.toArray(),
      values: [1, 0],
    }
  })))
}
/**
 * A knight’s close helmet of hand-forged steel, and nobody in it, 40 cm from the border of its gorget to the top of its tall comb: an egg of a skull with a brow reinforce, a visor of two plates standing proud of it, the upper one with its sight, the lower one drawn out into a sharp sparrow’s beak and pierced with breaths either side, all on a bell of a gorget of two lames with a rolled border riveted all round, pointed at the front.
 * It rests on the shoulders of the empty suit of armor at the end of the Bastion’s blind branch beside the Lodge, looking back with it toward the entrance, until the suit is pushed over and throws it off, and steers the flavor the Forge’s alchemy machine gives a Transparent Orb to a Spook Orb.
 * In its own frame it stands on the border of its gorget at the origin, looking along z.
 */
export default class Helmet extends Curio {
  readonly id = 'helmet'
  readonly mass = 3.2
  readonly orb = spookOrb
  readonly position: Vec3 = [lodgeSpurArmor[0], lodgeSpurArmor[1] + suitOfArmor.collar + 0.001, lodgeSpurArmor[2]]
  readonly reach = 0.4
  readonly room = 'bastion'
  readonly title = 'A knight’s helmet, with nobody in it'

  createModel() {
    const visorEdges = [visorSpan, -visorSpan]
    const combEdges = [-2.5, 2.5, 177.5, -177.5]
    const thetas = [...samples(-180, 174, 6, visorEdges), ...combEdges].toSorted((a, b) => a - b)
    const phis = samples(2, neck, 4, [browTop, visorTop, ...ventail])
    const polish = 0.12
    const shellGeometry = latticeGeometry(phis.map(phi => thetas.map((theta): LatticePoint => ({
      position: shell(theta, phi),
      values: [0, polish],
    }))), {
      start: {
        position: shell(0, 0),
        values: [0, polish],
      },
      extra: steelMask,
    })
    const gorgetThetas = Array.from({length: 48}, (_, index) => -180 + index * 7.5)
    const gorgetShares = [0, 0.12, 0.24, 0.36, gorgetLame - 0.002, gorgetLame + 0.002, 0.58, 0.7, 0.8, 0.88, 0.92, 0.95, 0.975, 1]
    const gorgetGeometry = latticeGeometry(gorgetShares.map(t => gorgetThetas.map((theta): LatticePoint => ({
      position: gorget(theta, t),
      values: [0, 0.08],
    }))), {extra: steelMask})
    // The sight either side of the bar, and the breaths
    const sight = [1, -1].map(side => opening(Array.from({length: 9}, (_, index) => side * (sightSpan[0] + (sightSpan[1] - sightSpan[0]) * index / 8)).toSorted((a, b) => a - b), sightBand))
    const breathHoles = breaths.map(at => opening([at - breathWidth / 2, at + breathWidth / 2], [breathBand[0], (breathBand[0] + breathBand[1]) / 2, breathBand[1]]))
    // The visor’s pivots on either side and a rivet above and below each, and a row round the gorget inside its border
    const skullRivets = [-1, 1].flatMap(side => [68, 88, 108].map(phi => ({
      position: shell(side * (visorSpan + 3), phi),
      normal: outward(shell, side * (visorSpan + 3), phi, 0.5),
    })))
    const gorgetRivets = Array.from({length: 24}, (_, index) => {
      const theta = -180 + index * 15 + 7.5
      return {
        position: gorget(theta, 0.85),
        normal: outward((round, down) => gorget(round, down), theta, 0.85, 0.01),
      }
    })
    const steel = mergeParts([shellGeometry, gorgetGeometry, ...sight, ...breathHoles, ...rivetHeads(skullRivets, 0.0068), ...rivetHeads(gorgetRivets, 0.0045)])
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
