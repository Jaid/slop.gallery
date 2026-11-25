import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, Fn, hash, mix, mx_noise_float, time, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'

import {detailNormal} from '../../candidates/deepseek/lib/detailNormal.ts'
import {filament} from '../../lib/filament.ts'
import {glints} from '../../lib/glints.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Wheels around the (2,3) knot; long enough that the coarse mesh resolves every tooth. */
const movementSections = 12
/** The machined relief of the movement, in object units along the tube normal, plus the section masks that the fragment stage reuses for engraving. All periodic patterns use integer revolutions so the tube seam stays invisible. */
function movement(tube: Node<'vec2'>, steps: number) {
  const along = tube.x.mul(movementSections)
  const index = along.floor()
  const local = along.fract()
  const kind = hash(index)
  const spin = hash(index.add(37.4))
// Each wheel advances in `steps` snapping ticks per revolution, like a clock escapement.
  const advance = time.mul(spin.mul(0.42).add(0.12)).add(kind.mul(3.1)).mul(steps)
  const snapping = advance.floor().add(advance.fract().smoothstep(0, 0.34)).div(steps)
  const turn = tube.y.add(snapping)
// Wheel section: a cog profile with eight to ten teeth around the tube.
  const toothCount = hash(index.add(91.3)).mul(3).floor().add(8)
  const tooth = turn.mul(toothCount).fract().sub(0.5).abs().mul(2)
  const gearHeight = tooth.smoothstep(0.58, 0.84).oneMinus().mul(0.0062)
// Collar section: a raised plate with a domed hub and a bevelled edge.
  const edge = local.sub(0.5).abs().mul(2)
  const plate = edge.smoothstep(0.6, 0.86).oneMinus().mul(0.0048)
  const hub = edge.mul(1.4).oneMinus().max(0).pow(1.4)
  const hubHeight = hub.mul(0.004)
// Recessed gaps between the wheels, where the bare tube shows through.
  const window = local.smoothstep(0, 0.055).mul(local.smoothstep(1, 0.945))
  const isGear = kind.smoothstep(0.42, 0.5)
  const rim = edge.smoothstep(0.16, 0.3).mul(edge.smoothstep(0.74, 0.88).oneMinus()).mul(isGear.oneMinus())
  const height = mix(plate.add(hubHeight), gearHeight, isGear).mul(window)
  return {
    along,
    edge,
    height,
    hub,
    index,
    isGear,
    kind,
    local,
    rim,
    spin,
    tooth,
    toothCount,
    turn,
    window,
  }
}
/** Escapement steps per wheel revolution. */
const escapementSteps = 8
/** A horological movement wound around the knot: cog wheels that snap forward in eight steps per revolution, collars of engine-turned brass, sapphire jewel bearings and dials painted with luminous enamel that keeps giving back the light of the room. Step closer and a century of lathe marks, dust and verdigris rises out of the metal. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    this.envMapIntensity = 0.8
    const tube = uv()
    const relief = Fn(([coordinate]: [Node<'vec2'>]) => {
      const {position, normal} = knotFrame(coordinate)
      const {height} = movement(coordinate, escapementSteps)
      return position.add(normal.mul(height))
    })
    this.positionNode = relief(tube)
    const epsilon = 0.0001
    const du = relief(tube.add(vec2(epsilon, 0))).sub(relief(tube.sub(vec2(epsilon, 0))))
    const dv = relief(tube.add(vec2(0, epsilon))).sub(relief(tube.sub(vec2(0, epsilon))))
    const reliefNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    const {hub, turn, index, local, isGear, tooth, rim, spin, window} = movement(tube, escapementSteps)
    const {p, near, intimate, grazing} = viewerFrame()
// Sixty tooth marks per revolution, every fifth one struck deeper, over engine-turned guilloché.
    const tick = filament(turn.mul(TAU * 30).sin(), 0.06).mul(rim)
    const longTick = filament(turn.mul(TAU * 6).sin(), 0.055).mul(turn.mul(12).floor().mod(2)).mul(rim)
    const guilloche = filament(turn.mul(TAU * 15).add(local.mul(TAU * 4).sin().mul(2.6)).sin(), 0.07).mul(rim)
// Lathe marks around the bare tube between the wheels, and the bristles of a brushed finish.
    const lathe = filament(tube.y.mul(TAU * 190).sin(), 0.05).mul(near)
    const bristle = filament(mx_noise_float(vec3(tube.x.mul(210), tube.y.mul(7), index.mul(2.3))).mul(1.6), 0.06).mul(near)
    const dust = mx_noise_float(p.mul(24)).mul(0.5).add(0.5).mul(near)
    const patina = mx_noise_float(p.mul(9).add(vec3(3.1, 7.7, 1.9))).mul(0.5).add(0.5).smoothstep(0.45, 0.72)
// Sapphire bearings are seated in the hub of every second collar.
    const jewel = hub.smoothstep(0.45, 0.75).mul(hash(index.add(53.1)).smoothstep(0.5, 0.6)).mul(isGear.oneMinus())
    const lumeGlow = mix(color(hsl.integer(160, 100, 93.3)), color(hsl.integer(232, 100, 80.4)), grazing)
    const alloy = mix(mix(color(hsl.integer(269, 62, 29)), color(hsl.integer(264, 9, 48)), spin.smoothstep(0.2, 0.4)), color(hsl.integer(83, 79, 67)), spin.smoothstep(0.38, 0.62))
    const groove = tick.mul(0.8).add(longTick).add(guilloche.mul(0.7)).add(lathe.mul(0.3)).clamp(0, 1)
// Oxidized shoulders between the wheels, where the raw iron of the frame shows.
    const gap = window.oneMinus().smoothstep(0.25, 0.85)
    const metalColor = mix(mix(alloy, color(hsl.integer(153, 34, 43)), patina.mul(0.3).mul(isGear.oneMinus())), color(hsl.integer(67, 11, 9)), groove.mul(0.7)).add(color(hsl.integer(77, 42, 26)).mul(dust).mul(0.25))
    const bodyColor = mix(metalColor, color(hsl.integer(302, 17, 12)), gap.mul(0.85))
// Engine-turned friction polishes the tooth flanks; the roots stay rough and dark.
    const flank = tooth.sub(0.5).abs().mul(2).oneMinus().clamp().mul(isGear)
    this.colorNode = mix(bodyColor, color(hsl.integer(261, 24, 7)), jewel.mul(0.7))
    this.metalnessNode = mix(float(0.94), float(0.5), groove.mul(0.3).add(patina.mul(0.25)).add(gap.mul(0.35))).sub(jewel.mul(0.45))
    this.roughnessNode = float(0.3).sub(flank.mul(0.18)).add(groove.mul(0.2)).add(bristle.mul(0.14)).add(dust.mul(0.18)).add(patina.mul(0.1)).add(gap.mul(0.22)).clamp(0.035, 1)
    this.anisotropy = 0.5
    this.normalNode = detailNormal(reliefNormal, groove.mul(0.01).add(bristle.mul(0.003)).add(lathe.mul(0.005)).add(jewel.mul(0.012)), 1)
    this.clearcoatNode = grazing.pow(2.4).mul(0.6).add(0.12)
    this.clearcoatRoughness = 0.1
    const lume = tick.add(longTick.mul(1.6)).add(guilloche.mul(0.5))
    const sparkle = glints(reliefNormal, 150).mul(jewel).mul(near.mul(0.7).add(0.3))
    this.emissiveNode = lumeGlow.mul(lume).mul(near.mul(0.6).add(0.3)).mul(0.32)
      .add(color(hsl.integer(264, 100, 51)).mul(jewel).mul(intimate.mul(0.8).add(0.35)).mul(0.45))
      .add(color(hsl.integer(263, 100, 96)).mul(sparkle).mul(1.2))
      .add(color(hsl.integer(166, 72, 80)).mul(bristle).mul(0.05))
  }
}
