import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_atan2, mx_noise_float, select, time, uv, vec2, vec3} from 'three/tsl'

import {ramp} from '../../candidates/claude_sonnet/lib/ramp.ts'
import {knotFrame} from '../../candidates/claude_sonnet/lib/tubeBasis.ts'
import {voronoi} from '../../candidates/claude_sonnet/lib/voronoiNearestPair.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

const eyeGrid: [number, number] = [35, 4]
const rotate = (v: Node<'vec2'>, a: Node<'float'>) => vec2(v.x.mul(a.cos()).add(v.y.mul(a.sin())), v.y.mul(a.cos()).sub(v.x.mul(a.sin())))

/** Watchers on a staggered lattice of the tube surface. Each is a creature of its own: size, tilt, sleepiness and iris. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = knotData.id
    const {objectDistance, facing, rim, view} = viewerFrame()
    const tube = uv()
    const q = tube.mul(vec2(...eyeGrid))
    const fpCell = q.fwidth().length().max(0.0005)
    // staggered lattice: odd rows shift half a cell
    const row = q.y.floor()
    const stagger = row.mod(2).mul(0.5)
    const column = q.x.sub(stagger).floor()
    const cell = wrapCell(vec2(column, row), vec2(...eyeGrid))
    const local = vec2(q.x.sub(stagger).fract().sub(0.5), q.y.fract().sub(0.5))
    const r = cellNoiseVec3(vec3(cell, 2.3))
    const r2 = cellNoiseVec3(vec3(cell, 8.1))
    const r3 = cellNoiseVec3(vec3(cell, 15.7))
    const window = ramp(local.abs().max(local.abs().yx).x, 0.5, 0.4)
    // eye frame: width ±1, tilted and scaled per creature
    const size = r.z.mul(0.25).add(0.8)
    const width = size.mul(0.4)
    const tilt = r.x.sub(0.5).mul(0.6)
    const e = rotate(local.sub(vec2(r.x.sub(0.5), r.y.sub(0.5)).mul(0.1)), tilt).div(width)
    const fp = fpCell.div(width)
    // wakefulness: distance wakes them, each with its own threshold; random blinks on top
    const sleepy = objectDistance.add(r2.x.sub(0.5).mul(1.1))
    const wake = ramp(sleepy, 4.3, 2.4)
    const near = ramp(objectDistance, 3.6, 1.3)
    const clock = time.add(r2.y.mul(40)).div(r2.z.mul(3.5).add(3)).fract()
    const blink = clock.smoothstep(0, 0.012).mul(ramp(clock, 0.075, 0.03))
    const breathe = time.mul(0.9).add(r.y.mul(TAU)).sin().mul(0.03)
    const open = wake.mul(0.96).add(0.04).add(breathe.mul(wake)).mul(blink.oneMinus()).clamp(0, 1)
    // eyelid aperture
    const arch = e.x.abs().oneMinus().max(0).pow(0.8)
    const upper = arch.mul(open).mul(0.64)
    const lower = arch.mul(open).mul(0.42)
    const inside = upper.sub(e.y).min(e.y.add(lower)).min(e.x.abs().oneMinus().mul(2))
    const ap = inside.smoothstep(fp.negate(), fp).mul(window)
    const outside = inside.negate().max(0)
    const seam = open.oneMinus().mul(ramp(e.y.abs(), 0.07, 0.02)).mul(ramp(e.x.abs(), 1, 0.82)).mul(window)
    // gaze: the iris slides toward wherever the viewer stands
    const basis = knotFrame(tube)
    const toViewer = vec2(view.dot(basis.along), view.dot(basis.around))
    const gaze = rotate(toViewer, tilt).mul(0.7).clamp(-0.45, 0.45)
      .add(vec2(time.mul(1.7).add(r3.x.mul(40)).floor().sin().mul(0.04), time.mul(1.3).add(r3.y.mul(40)).floor().cos().mul(0.03)))
    const irisSpace = e.sub(gaze)
    const radius = irisSpace.length()
    const irisSize = float(0.66)
    const rho = radius.div(irisSize)
    const angle = mx_atan2(irisSpace.y, irisSpace.x.add(0.00001)) as unknown as Node<'float'>
    const irisMask = ramp(rho, 1, fp.div(irisSize).mul(1.5).max(0.02).oneMinus())
    // slit pupil dilated by attention
    const dilate = near.mul(0.28).add(0.1).add(wake.mul(0.04))
    const pupilX = irisSpace.x.abs().div(irisSize.mul(dilate))
    const pupilY = irisSpace.y.div(irisSize.mul(1.02))
    const pupil = ramp(pupilX.mul(pupilX).add(pupilY.mul(pupilY).pow(2)).sqrt(), 1, 0.82)
    // iris: radial fibers, collarette and limbal ring
    const ring = vec3(angle.cos(), angle.sin(), 0)
    const fibers = mx_noise_float(ring.mul(7).add(vec3(0, 0, rho.mul(1.6)))).mul(0.5).add(0.5)
    const fine = mx_noise_float(ring.mul(19).add(vec3(3, 5, rho.mul(3.1)))).mul(0.5).add(0.5)
    const collarette = ramp(rho.sub(0.42).abs(), 0.1, 0).mul(0.6)
    const limbal = rho.smoothstep(0.78, 1)
    const hueIndex = r3.z.mul(4).floor()
    const species = (amber: Node<'color'>, green: Node<'color'>, cyan: Node<'color'>, violet: Node<'color'>) => select(hueIndex.lessThan(0.5), amber, select(hueIndex.lessThan(1.5), green, select(hueIndex.lessThan(2.5), cyan, violet)))
    const inner = species(color(hsl.integer(91.3, 100, 85.9)), color(hsl.integer(139, 100, 89.5)), color(hsl.integer(215, 100, 86.7)), color(hsl.integer(313, 100, 78)))
    const outer = species(color(hsl.integer(39, 100, 41)), color(hsl.integer(156, 98, 38)), color(hsl.integer(260, 93, 37)), color(hsl.integer(293, 89, 29)))
    const iris = mix(inner, outer, rho.pow(0.8)).mul(fibers.mul(0.75).add(fine.mul(0.5)).add(collarette).add(0.2))
      .mul(limbal.oneMinus().mul(0.85).add(0.15))
    const lit = ap.mul(irisMask).mul(pupil.oneMinus())
    const eyeshine = facing.pow(5).mul(1.6).add(0.55)
    const lidShade = ramp(outside, 0.5, 0).mul(0.5)
    // skin: overlapping scales
    const scaleGrid: [number, number] = [175, 20]
    const scales = voronoi(tube.mul(vec2(...scaleGrid)), scaleGrid, 4, 0.8)
    const scaleRandom = cellNoiseVec3(vec3(scales.cell, 6.6))
    const dome = scales.f2.sub(scales.f1).smoothstep(0, 0.45)
    const skinTone = mix(color(hsl.integer(156, 41, 10)), color(hsl.integer(86, 58, 18)), scaleRandom.x.mul(0.7).add(scales.f1.mul(0.5)))
    const tint = mix(color(hsl.integer(170, 75, 34)), color(hsl.integer(301, 61, 33.6)), scaleRandom.y)
    const skin = skinTone.add(tint.mul(dome.pow(3)).mul(0.5)).mul(lidShade.oneMinus().mul(0.75).add(0.25))
    const sclera = mix(color(hsl.integer(43, 18, 4)), color(hsl.integer(25, 48, 11)), mx_noise_float(vec3(e.mul(5), 1)).mul(0.5).add(0.5))
    // relief: brow, lid rim, recessed eyeball with a bulging cornea
    const browDistance = vec2(e.x.div(1.4), e.y.div(0.95)).length()
    const brow = browDistance.sub(1.1).pow2().mul(-9).exp().mul(0.007).mul(window)
    const rimHeight = ramp(outside, 0.3, 0).mul(0.004).mul(window).mul(open.mul(0.7).add(0.3))
    const cornea = vec2(e.x.mul(0.8), e.y.div(0.55)).length().pow2().oneMinus().max(0).sqrt().mul(0.006)
    const height = dome.mul(0.0014).add(brow).add(rimHeight).sub(ap.mul(0.005)).add(cornea.mul(ap))
    this.colorNode = mix(mix(skin, sclera, ap), iris.mul(0.35), lit)
    this.metalnessNode = mix(float(0.4), float(0), ap)
    this.roughnessNode = mix(dome.oneMinus().mul(0.25).add(0.3), float(0.06), ap)
    this.clearcoatNode = mix(float(0.12), float(1), ap)
    this.clearcoatRoughnessNode = mix(float(0.3), float(0.02), ap)
    this.normalNode = proceduralNormal(height, 1)
    this.emissiveNode = iris.mul(lit).mul(eyeshine).mul(1.15)
      .add(color(hsl.integer(51, 100, 71)).mul(seam).mul(0.35).mul(wake))
      .add(color(hsl.integer(170, 100, 89.4)).mul(rim).mul(0.04))
  }
}
