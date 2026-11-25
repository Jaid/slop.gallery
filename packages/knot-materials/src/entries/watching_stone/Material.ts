import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {float, luminance, mix, mx_noise_float, normalLocal, normalViewGeometry, pmremTexture, tangentLocal, time, vec3} from 'three/tsl'

import {ambientRadiance, toWorldDirection} from '../../candidates/claude_opus/lib/environmentHighlight.ts'
import {rgb} from '../../candidates/claude_opus/lib/rgb.ts'
import {knotLength, loopCoordinate, tubeCircumference, tubeCoordinates} from '../../candidates/claude_opus/lib/tubeCoordinates.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Folds as integer (along, around) wave numbers, so every term is seamless on the tube. */
const folds = [{
  along: 7,
  around: 1,
  amplitude: 0.9,
  phase: 0.3,
}, {
  along: -13,
  around: 2,
  amplitude: 0.45,
  phase: 1.7,
}, {
  along: 29,
  around: -1,
  amplitude: 0.22,
  phase: 4.1,
}, {
  along: -53,
  around: 3,
  amplitude: 0.1,
  phase: 2.2,
}, {
  along: 97,
  around: 1,
  amplitude: 0.04,
  phase: 5.3,
}]
/** Veins run lengthwise and meander; this many fit around the tube. (A helical twist is impossible: with coprime windings every vein would be one and the same strip, and no vein could keep its own mineral.) */
const veinsAround = 15
/** Each vein changes mineral along its length in this many segments. */
const veinSegments = 11
type Mineral = {
  base: number
  deep: number
  metal: number
  sheen: number
  silk: number
}
/** Folded vein layering with an analytic gradient in tube space: bands are the veins, fibers grow straight across them. */
function veins(along: Node<'float'>, around: Node<'float'>, octaves = folds.length) {
  let band: Node<'float'> = around.mul(veinsAround)
  let dAlong: Node<'float'> = float(0)
  let dAround: Node<'float'> = float(veinsAround)
  for (const fold of folds.slice(0, octaves)) {
    const angle = along.mul(fold.along).add(around.mul(fold.around)).mul(TAU).add(fold.phase)
    band = band.add(angle.sin().mul(fold.amplitude))
    const slope = angle.cos().mul(fold.amplitude * TAU)
    dAlong = dAlong.add(slope.mul(fold.along))
    dAround = dAround.add(slope.mul(fold.around))
  }
// Physical gradient: tube-space derivatives divided by the knot length and the tube circumference.
  const gradientAlong = dAlong.div(knotLength)
  const gradientAround = dAround.div(tubeCircumference)
  return {
    band,
    gradientAlong,
    gradientAround,
  }
}
// Golden and honey tiger's eye dominate; umber, red tiger's eye and rare hematite seams interleave like tiger iron.
const minerals: Array<[number, Mineral]> = [[0.42, {
  base: hsl.integer(59, 90, 43),
  deep: hsl.integer(52, 87, 25),
  silk: hsl.integer(73, 100, 78),
  sheen: 1,
  metal: 0,
}], [0.64, {
  base: hsl.integer(68, 91, 58),
  deep: hsl.integer(58, 88, 32),
  silk: hsl.integer(84.4, 100, 84),
  sheen: 1,
  metal: 0,
}], [0.84, {
  base: hsl.integer(51, 83, 25),
  deep: hsl.integer(47, 76, 12),
  silk: hsl.integer(65, 89, 72),
  sheen: 0.9,
  metal: 0,
}], [0.95, {
  base: hsl.integer(40, 89, 31),
  deep: hsl.integer(40, 84, 14),
  silk: hsl.integer(54, 100, 73),
  sheen: 0.7,
  metal: 0,
}], [1, {
  base: hsl.integer(271, 6, 33),
  deep: hsl.integer(277, 8, 17),
  silk: hsl.integer(256, 26, 92),
  sheen: 0,
  metal: 1,
}]]
/** Directions on the half-cone a fiber reflects into, as angles away from the surface normal. */
const coneAngles = [-0.35, 0, 0.35]
/** Tiger's eye and tiger iron. Crocidolite fibers grow straight across each folded vein. A fiber is a tiny cylinder that mirrors light into a cone around its axis, so the stone samples the real room along that cone: veins blaze where their fibers stand square to the light, and neighboring veins lean their fibers opposite ways, flipping between gold and umber as you walk. A second, silken eye is lit from the visitor's own position – it follows them, and narrows when they lean close. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.5)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const n = normalLocal.normalize()
    const {along, around} = tubeCoordinates()
    const {band, gradientAlong, gradientAround} = veins(along, around)
    const alongDirection = tangentLocal.xyz.normalize()
    const aroundDirection = n.cross(alongDirection).normalize()
    const gradient = alongDirection.mul(gradientAlong).add(aroundDirection.mul(gradientAround))
// The large folds alone steer the eye, so it glides as one smooth seam instead of crackling with every ripple.
    const broad = veins(along, around, 2)
    const broadFiber = alongDirection.mul(broad.gradientAlong).add(aroundDirection.mul(broad.gradientAround)).normalize()
    const index = band.floor()
// The same vein is numbered k and k + veinsAround on either side of the tube's seam; every identity uses the wrapped index.
    const vein = index.mod(veinsAround)
    const across = band.fract()
// Identities wrap with the tube coordinates, so no seam appears where the knot closes.
    const segment = along.mul(veinSegments).add(mx_noise_float(vec3(vein.mul(3.1), around.mul(TAU).sin(), around.mul(TAU).cos())).mul(0.6)).floor().mod(veinSegments)
    const rnd = cellNoiseVec3(vec3(vein, segment, 7.5))
    const rndVein = cellNoiseVec3(vec3(vein, -4.5, 2.5))
// Fibers run along the vein gradient, lying in the polished surface.
    const fiber = gradient.normalize()
    const lean = rndVein.y.greaterThan(0.5).select(float(1), float(-1)).mul(rndVein.z.mul(0.3).add(0.45))
    const fiber3d = fiber.add(n.mul(lean)).normalize()
// Fine silky striations, elongated along the fibers and faded before they would shimmer.
// Veins run lengthwise, so arc length is (nearly) constant along a fiber and makes a clean across-fiber coordinate.
    const striationCount = Math.round(knotLength * 260)
    const striationLoop = loopCoordinate(along, striationCount)
    const striationCoordinate = vec3(striationLoop.x, striationLoop.y, band.mul(1.5).add(vein.mul(5.3)))
    const striationResolved = along.mul(striationCount).fwidth().smoothstep(0.2, 0.6).oneMinus()
    const striation = mx_noise_float(striationCoordinate).mul(striationResolved)
    const mineral = rnd.x
    const pick = (key: 'base' | 'deep' | 'silk') => {
      let result = rgb(minerals[0][1][key])
      for (let i = 1;i < minerals.length;i++) {
        result = mix(result, rgb(minerals[i][1][key]), mineral.step(minerals[i - 1][0]))
      }
      return result
    }
    const pickValue = (key: 'metal' | 'sheen') => {
      let result: Node<'float'> = float(minerals[0][1][key])
      for (let i = 1;i < minerals.length;i++) {
        result = mix(result, float(minerals[i][1][key]), mineral.step(minerals[i - 1][0]))
      }
      return result
    }
    const sheenStrength = pickValue('sheen')
    const hematite = pickValue('metal')
// Vein interiors grade from a dark suture to a luminous center; the suture also hides the mineral switch from aliasing.
    const edgeDistance = across.min(across.oneMinus())
    const segmentPhase = along.mul(veinSegments).add(mx_noise_float(vec3(vein.mul(3.1), around.mul(TAU).sin(), around.mul(TAU).cos())).mul(0.6))
    const segmentEdge = segmentPhase.fract().min(segmentPhase.fract().oneMinus())
    const suture = edgeDistance.smoothstep(0, band.fwidth().mul(1.5).add(0.22)).mul(segmentEdge.smoothstep(0, segmentPhase.fwidth().mul(1.5).add(0.12)))
    const mottling = mx_noise_float(p.mul(5).add(vein.mul(0.3))).mul(0.5).add(0.5)
    const base = mix(pick('deep'), pick('base'), suture.mul(mottling.mul(0.5).add(0.7)).clamp()).mul(striation.mul(0.16).add(1))
    const silk = pick('silk')
// Cylinder reflection of the real room: a fiber returns light from the cone where L·T = −V·T.
    const axial = fiber3d.dot(view)
    const radial = axial.pow2().oneMinus().max(0).sqrt()
    const coneBase = n.sub(fiber3d.mul(n.dot(fiber3d))).normalize()
    const coneSide = fiber3d.cross(coneBase)
    let roomLight: Node<'vec3'> = vec3(0)
    for (const angle of coneAngles) {
      const direction = fiber3d.mul(axial.negate()).add(coneBase.mul(Math.cos(angle)).add(coneSide.mul(Math.sin(angle))).mul(radial))
      roomLight = roomLight.add(pmremTexture(environment, toWorldDirection(direction), float(0.12)))
    }
// Normalized by the room's average radiance, so veins ignite against their neighbors in any gallery lighting.
    const ambient = ambientRadiance(environment, n)
    const ignition = luminance(roomLight.div(coneAngles.length)).div(ambient).smoothstep(1.4, 3.5).mul(0.7)
// Diffuse gallery light does the same from every side; leaning fibers make neighboring veins take turns.
    const flip = axial.pow2().oneMinus().max(0).pow(28)
// The visitor's own eye-light: bright where a fiber stands square to the line of sight; up close the eye narrows like a pupil.
    const narrowing = near.mul(90).add(45)
// The eye uses the fibers' in-plane direction, so it runs as one unbroken seam of light along the tube's crest.
    const eye: Node<'float'> = broadFiber.dot(view).pow2().oneMinus().max(0).pow(narrowing).mul(facing.pow(0.5))
    const breath = time.mul(0.35).add(vein.mul(TAU * 4 / veinsAround)).sin().mul(0.1).add(0.9)
    const silkiness = sheenStrength.mul(striation.mul(0.45).add(0.85))
// The fibers themselves are dim; most of the gold is light they return.
    this.colorNode = mix(base.mul(0.4), rgb(hsl.integer(264, 8, 40)), hematite)
    this.metalnessNode = hematite
    this.roughnessNode = mix(float(0.5), float(0.16), hematite).sub(striation.mul(0.04))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.03
    this.clearcoatNormalNode = normalViewGeometry
    this.normalNode = proceduralNormal(striation.mul(0.2).add(hematite.mul(suture).mul(0.5)), 0.0008)
    this.emissiveNode = silk.mul(ignition.add(flip.mul(0.8))).mul(silkiness).mul(base.div(pick('base')).mul(0.6).add(0.4))
      .add(silk.mul(eye).mul(silkiness).mul(breath).mul(near.mul(0.5).add(0.75)))
      .add(silk.mul(eye.pow(6)).mul(sheenStrength).mul(intimate).mul(0.25))
      .add(silk.mul(grazing.pow(5)).mul(sheenStrength).mul(0.04))
  }
}
