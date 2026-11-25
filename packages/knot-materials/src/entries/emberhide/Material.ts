import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {float, mix, mx_noise_float, normalLocal, positionGeometry, tangentLocal, time, transformNormalToView, vec2, vec3} from 'three/tsl'

import {rgb} from '../../candidates/claude_fable/lib/rgb.ts'
import {scaleLattice} from '../../candidates/claude_fable/lib/scaleLattice.ts'
import {knotLength, tubeCircumference, tubeCoordinates} from '../../candidates/claude_fable/lib/tubeCoordinates.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Rows of scales along the knot and lattice units around it – both even, so the staggered rows close seamlessly. */
const rowsAlong = 96
const unitsAround = 16
const scaleRadius = 1.04
/** Physical size of one lattice unit in each direction, in object units. */
const unitAlong = knotLength / rowsAlong
const unitAround = tubeCircumference / unitsAround
/** Dragon hide: rows of overlapping, keeled scales, each a tilted iridescent dome, with slow fire breathing underneath. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const {view, facing, grazing, near, intimate} = viewerFrame()
    const {along, around} = tubeCoordinates()
    const n = normalLocal.normalize()
    const alongDirection = tangentLocal.normalize()
    const aroundDirection = n.cross(alongDirection).normalize()
// Rows run around the tube and advance along the knot, so scales overlap like a snake's: the row behind covers the row ahead.
    const coord = vec2(around.mul(unitsAround), along.mul(rowsAlong))
    const {local, distance, row, column} = scaleLattice(coord, scaleRadius)
    const identity = cellNoiseVec3(vec3(column.mod(unitsAround / 2), row.mod(rowsAlong), 7))
    const identity2 = cellNoiseVec3(vec3(column.mod(unitsAround / 2).add(31), row.mod(rowsAlong).add(17), 2))
// The overlap: the next row's discs cover this scale's top. Distance to that covering edge lets the rim read as a step.
    const inside = distance.div(scaleRadius)
    const dome = inside.pow2().oneMinus().max(0).sqrt()
    const rim = inside.smoothstep(0.86, 1).mul(inside.fwidth().mul(8).smoothstep(0.5, 0.05))
    const keel = local.x.abs().smoothstep(0.14, 0.03).mul(local.y.smoothstep(0.7, -0.4))
// Growth ridges: concentric arcs on each scale, only resolved when close.
    const ridges = distance.mul(9).add(identity.z.mul(4)).sin().mul(0.5).add(0.5).mul(distance.mul(9).fwidth().smoothstep(1.4, 0.3)).mul(inside.smoothstep(0.2, 0.5))
// Scale normal: a dome tilting toward its edges, a sharp keel, fine ridges and a slight random lean per scale.
    const slope = local.div(dome.max(0.2)).mul(0.33)
    const lean = identity.xy.sub(0.5).mul(0.12)
    const keelTilt = local.x.sign().mul(keel).mul(0.5)
    const tiltAround = slope.x.add(lean.x).add(keelTilt).add(local.x.sign().mul(ridges).mul(0.05).mul(near)).mul(unitAlong / unitAround)
    const tiltAlong = slope.y.add(lean.y).add(ridges.mul(0.04).mul(near))
    const scaleNormal = n.sub(aroundDirection.mul(tiltAround)).sub(alongDirection.mul(tiltAlong)).normalize()
    const scaleNormalView = transformNormalToView(scaleNormal)
    this.normalNode = scaleNormalView
// Breathing: a slow swell that travels along the knot, lifting a little fire into the gaps between the scales.
    const breath = time.mul(0.55).sub(along.mul(Math.PI * 4)).sin().mul(0.5).add(0.5).pow(2)
    const breathNoise = mx_noise_float(positionGeometry.mul(5).add(time.mul(0.15))).mul(0.5).add(0.5)
// The scales lift with each breath: the glowing gap under every exposed edge widens and brightens.
    const lift = breath.mul(0.14).add(0.06)
    const gap = inside.smoothstep(float(0.98).sub(lift), float(1.01).sub(lift.mul(0.35)))
    const underglow = gap.mul(breath.mul(0.7).add(0.3)).mul(breathNoise.mul(0.6).add(0.4))
    const ember = mix(rgb(hsl.integer(33.6, 100, 59.5)), rgb(hsl.integer(72, 100, 79.1)), breath)
// Pigment: deep green-black hide, bronze keels, pale worn edges, each scale a touch different.
    const hide = mix(rgb(hsl.integer(159, 47, 10)), rgb(hsl.integer(150, 59, 18)), identity.x)
    const bronze = rgb(hsl.integer(67, 72, 43))
    const worn = rgb(hsl.integer(152, 32, 42))
    let pigment = mix(hide, worn, inside.smoothstep(0.55, 0.95).mul(identity2.x.smoothstep(0.3, 0.9)).mul(0.6))
    pigment = mix(pigment, bronze, keel.mul(0.7))
    pigment = mix(pigment, rgb(hsl.integer(145, 27, 3)), rim.max(gap).mul(0.85))
// Seen at grazing angles, more of the underside is exposed and the fire shows through the rows.
    const exposure = grazing.pow(1.5).mul(0.7).add(0.3)
    this.colorNode = pigment
    this.metalness = 0.15
    this.roughnessNode = mix(float(0.22), float(0.5), rim).sub(keel.mul(0.1)).add(ridges.mul(0.08).mul(near)).clamp(0.08, 0.8)
    this.clearcoat = 1
    this.clearcoatRoughnessNode = mix(float(0.06), float(0.3), rim)
    this.clearcoatNormalNode = scaleNormalView
    this.iridescence = 1
    this.iridescenceIOR = 1.35
    this.iridescenceThicknessNode = identity.z.mul(260).add(260).add(dome.mul(120))
    this.sheen = 0.35
    this.sheenColor.set(hsl.integer(156, 81, 57))
    this.sheenRoughness = 0.6
    const sparkle = glints(scaleNormalView, 180).mul(keel.add(ridges.mul(0.4))).mul(0.5)
    const warmth = view.dot(n).clamp().pow(3).mul(intimate).mul(breath).mul(0.08)
    this.emissiveNode = ember.mul(underglow).mul(exposure).mul(2.6).add(rgb(hsl.integer(78, 100, 89)).mul(sparkle)).add(rgb(hsl.integer(38, 100, 63.1)).mul(warmth)).add(rgb(hsl.integer(153, 86, 33)).mul(facing.oneMinus().pow(4)).mul(0.05))
  }
}
