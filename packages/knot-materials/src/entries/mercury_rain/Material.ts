import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, float, Fn, Loop, mix, modelWorldMatrixInverse, negateOnBackSide, transformNormalToView, uv, varying, vec2, vec3, vec4} from 'three/tsl'

import {loopPhase} from '../../candidates/claude_sonnet/lib/loopClock.ts'
import {rgb} from '../../candidates/claude_sonnet/lib/rgb.ts'
import {knotArcLength, knotLength, tubeCircumference} from '../../candidates/claude_sonnet/lib/tubeCoordinates.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

type Level = {
  along: number
  around: number
/** Sharpness of the log-sum-exp union, in 1/units; larger means droplets merge with a thinner neck. */
  blend: number
  height: number
  radius: number
  seed: number
}
const large: Level = {
  along: 64,
  around: 8,
  blend: 170,
  height: 0.03,
  radius: 0.066,
  seed: 3,
}
const small: Level = {
  along: 176,
  around: 22,
  blend: 420,
  height: 0.0085,
  radius: 0.0215,
  seed: 29,
}
const cameraLocal = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz
/** Evaluate both droplet generations through one compact GPU function, retaining the original nine-neighbor sum and motion. */
const dropletHeight = Fn(([tube, counts, parameters, amount, clock]: [Node<'vec2'>, Node<'vec2'>, Node<'vec4'>, Node<'float'>, Node<'float'>]) => {
  const blend = parameters.x
  const height = parameters.y
  const radiusScale = parameters.z
  const seed = parameters.w
  const along = knotArcLength(tube.x).mul(counts.x).toVar()
  const around = tube.y.mul(counts.y).toVar()
  const pitch = vec2(float(knotLength).div(counts.x), float(tubeCircumference).div(counts.y)).toVar()
  const baseAlong = along.floor().toVar()
  const baseAround = around.floor().toVar()
  const sum = float(0).toVar()
  // i = -1..1 outside j = -1..1, exactly as in the authored accumulation.
  Loop(9, ({i}) => {
    const row = float(i).div(3).floor().sub(1)
    const column = float(i).mod(3).sub(1)
    const cellAlong = baseAlong.add(row).toVar()
    const cellAround = baseAround.add(column).toVar()
    const identity = vec3(cellAlong.mod(counts.x), cellAround.mod(counts.y), seed).toVar()
    const random = cellNoiseVec3(identity).toVar()
    const random2 = cellNoiseVec3(identity.add(vec3(7.7, 3.1, 1.3))).toVar()
    const phase = clock.add(random.z.mul(TAU)).toVar()
    const wander = vec2(phase.sin(), phase.add(random2.x.mul(TAU)).cos()).mul(0.3).toVar()
    const center = vec2(cellAlong, cellAround).add(random.xy.mul(0.5).add(0.25)).add(wander).toVar()
    const distance = vec2(along, around).sub(center).mul(pitch).length().toVar()
    const breathing = phase.mul(2).add(random2.y.mul(TAU)).sin().mul(0.14).add(1).toVar()
    const drop = random2.z.mul(0.55).add(0.4).toVar()
    const radius = drop.mul(radiusScale).mul(breathing).toVar()
    const cap = distance.div(radius).pow2().oneMinus().max(0).sqrt().mul(radius).mul(height.div(radiusScale)).toVar()
    sum.addAssign(cap.mul(blend).exp().sub(1).mul(random2.x.smoothstep(0.16, 0.26)))
  })
  return sum.add(1).log().div(blend).mul(amount)
}).setLayout({
  name: 'mercuryRainDropletHeight',
  type: 'float',
  inputs: [
    {
      type: 'vec2',
      name: 'tube',
    },
    {
      type: 'vec2',
      name: 'counts',
    },
    {
      type: 'vec4',
      name: 'parameters',
    },
    {
      type: 'float',
      name: 'amount',
    },
    {
      type: 'float',
      name: 'clock',
    },
  ],
})
/** Height of a raft of sessile droplets, unioned with a soft maximum so neighbors bridge and pinch like real mercury. */
function droplets(tube: Node<'vec2'>, level: Level, amount: Node<'float'> | number) {
  return dropletHeight(tube, vec2(level.along, level.around), vec4(level.blend, level.height, level.radius, level.seed), typeof amount === 'number' ? float(amount) : amount, loopPhase)
}
const mercurySurface = Fn(([tube, detail]: [Node<'vec2'>, Node<'float'>]) => {
  const {position, normal} = knotFrame(tube)
  const pull = cameraLocal.sub(position).length().smoothstep(0.9, 4.2).oneMinus()
  const height = droplets(tube, large, 1).add(droplets(tube, small, detail.mul(pull.mul(0.85).add(0.15))))
  return position.add(normal.mul(height))
})
/** Quicksilver on a dark oxidized film. Two generations of droplets crawl over the knot, merging into fat mirror pools and letting go again; the finer generation condenses as you come closer. Because the drops are real geometry, every one holds an upside-down copy of the room that slides across it as you move, and the tarnish between them is a thin film that shifts through bronze and violet. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.75)
    this.name = knotData.id
    const tube = uv()
    const {p, facing, grazing, near, intimate} = viewerFrame()
    this.positionNode = mercurySurface(tube, float(1))
    const stepAlong = 4e-4
    const stepAround = 2e-3
    const du = mercurySurface(tube.add(vec2(stepAlong, 0)), float(1)).sub(mercurySurface(tube.sub(vec2(stepAlong, 0)), float(1)))
    const dv = mercurySurface(tube.add(vec2(0, stepAround)), float(1)).sub(mercurySurface(tube.sub(vec2(0, stepAround)), float(1)))
    const {normal: baseNormal} = knotFrame(tube)
    const raw = du.cross(dv)
    const outward = raw.mul(raw.dot(baseNormal).sign()).normalize()
    this.normalNode = negateOnBackSide(varying(transformNormalToView(outward)).normalize())
    const height = droplets(tube, large, 1).add(droplets(tube, small, near.mul(0.85).add(0.15))).toVar()
    const mirror = height.smoothstep(0.0008, 0.0035)
    const pooled = height.smoothstep(0.014, 0.03)
// The dark film: bronze at the edges of each pool where it is thin, indigo where it thickens.
    const filmPhase = height.mul(90).add(grazing.mul(1.6)).add(p.y.mul(2))
    const tarnish = vec3(filmPhase.cos(), filmPhase.add(2.1).cos(), filmPhase.add(4.2).cos()).mul(0.5).add(0.5)
    const dross = mix(rgb(hsl.integer(285, 17, 6)), mix(rgb(hsl.integer(69, 43, 20)), rgb(hsl.integer(289, 59, 15)), tarnish.y), tarnish.x.mul(0.6).add(0.1)).mul(0.9)
    this.colorNode = mix(dross, mix(rgb(hsl.integer(266, 15, 77)), rgb(hsl.integer(265, 27, 90)), pooled.mul(0.5)), mirror)
    this.metalness = 1
    this.roughnessNode = mix(float(0.34), float(0.018), mirror)
    this.iridescence = 0.3
    this.iridescenceIOR = 1.6
    this.iridescenceThicknessMinimum = 180
    this.iridescenceThicknessMaximum = 460
    this.emissiveNode = rgb(hsl.integer(0, 0, 100)).mul(mirror).mul(facing.pow(6)).mul(intimate).mul(0.05)
  }
}
