import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, float, Fn, mix, modelWorldMatrixInverse, mx_cell_noise_float, mx_fractal_noise_float, mx_noise_float, positionLocal, positionView, positionViewDirection, select, time, transformNormalToView, uv, vec2, vec3, vec4, vertexStage} from 'three/tsl'
import {Vector3} from 'three/webgpu'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import knotData from './data.ts'

/** Where the fuzzy fellows sit: tube coordinate along the knot and the around-the-tube heading each one looks toward (0.75 faces +z, the gallery's default viewpoint; 0.25 faces −z; 0.5 faces away from the knot's axis). Found by a greedy search with local refinement over 576 candidate spots: the worst of 96 viewpoints around the exhibit (with tube self-occlusion) still meets someone's face as squarely as possible, while the front, 45°, 90° and closeup views stay strong. Spots are at least 0.55 object units apart along the tube. */
const facePlacements = [{
  tube: 0,
  heading: 0.5,
}, {
  tube: 0.125,
  heading: 0.625,
}, {
  tube: 0.2639,
  heading: 0.375,
}, {
  tube: 0.4167,
  heading: 0.625,
}, {
  tube: 0.5694,
  heading: 0.375,
}, {
  tube: 0.7222,
  heading: 0.375,
}, {
  tube: 0.8056,
  heading: 0.875,
}] as const
const faceCount = facePlacements.length
type FaceFrame = {
/** Arc length from the tube seam to the face center, object units. */
  arc: number
  heading: number
/** Components of object-space +y in the face's (along-tube, around-tube) surface basis; rotates the face upright. */
  upAlong: number
  upAround: number
}
/** CPU twin of `knotCurve` for the exhibition's (2, 3) torus knot. */
function knotPoint(angle: number) {
  const phase = angle * 1.5
  const radius = (Math.cos(phase) + 2) * 0.225
  return new Vector3(radius * Math.cos(angle), radius * Math.sin(angle), Math.sin(phase) * 0.225)
}
const curveSpeed = (angle: number) => knotPoint(angle + 0.0001).distanceTo(knotPoint(angle - 0.0001)) / 0.0002
/** The curve's speed is a smooth even function of the radial phase, so a few cosine terms reproduce it to 1e-5. Integrating them gives a closed-form arc length the shader can evaluate per fragment. */
const speedHarmonics = (() => {
  const steps = 2048
  const harmonics: Array<number> = []
  for (let k = 0;k < 4;k++) {
    let sum = 0
    for (let i = 0;i < steps;i++) {
      const angle = (i + 0.5) / steps * TAU * 2
      sum += curveSpeed(angle) * Math.cos(1.5 * k * angle)
    }
    harmonics.push(sum / steps * (k === 0 ? 1 : 2))
  }
  return harmonics
})()
/** Arc length from the tube seam (tube.x = 0) to the given curve angle. */
function arcLengthCpu(angle: number) {
  let length = speedHarmonics[0] * angle
  for (let k = 1;k < speedHarmonics.length;k++) {
    length += speedHarmonics[k] / (1.5 * k) * Math.sin(1.5 * k * angle)
  }
  return length
}
const knotLength = arcLengthCpu(TAU * 2)
/** CPU twin of `knotFrame`: the same tube frame the shader uses, so the precomputed rotation matches exactly. */
function tubeBasis(tubeX: number, tubeY: number) {
  const angle = tubeX * TAU * 2
  const center = knotPoint(angle)
  const next = knotPoint(angle + 0.01)
  const tangent = next.clone().sub(center)
  const binormal = tangent.clone().cross(next.clone().add(center)).normalize()
  const frameNormal = binormal.clone().cross(tangent).normalize()
  const around = tubeY * TAU
  const normal = frameNormal.clone().multiplyScalar(-Math.cos(around)).add(binormal.clone().multiplyScalar(Math.sin(around)))
  const aroundDirection = frameNormal.clone().multiplyScalar(Math.sin(around)).add(binormal.clone().multiplyScalar(Math.cos(around)))
  return {
    along: tangent.clone().normalize(),
    around: aroundDirection,
    normal,
  }
}
function createFaceFrame({tube, heading}: {
  heading: number
  tube: number
}): FaceFrame {
  const basis = tubeBasis(tube, heading)
  const up = new Vector3(0, 1, 0)
  up.sub(basis.normal.clone().multiplyScalar(up.dot(basis.normal))).normalize()
  return {
    arc: arcLengthCpu(tube * TAU * 2),
    heading,
    upAlong: up.dot(basis.along),
    upAround: up.dot(basis.around),
  }
}
const faceFrames: ReadonlyArray<FaceFrame> = facePlacements.map(createFaceFrame)
const tubeRadius = 0.13
const tubeCircumference = TAU * tubeRadius
const earHeight = 0.09
type FaceLocal = {
/** Index of the nearest face center along the tube. */
  cell: Node<'float'>
/** Face-horizontal offset from the face center (object units, positive toward the face's right). */
  x: Node<'float'>
/** Face-vertical offset from the face center (object units, positive toward the ears). */
  y: Node<'float'>
}
/** Per-face constant chosen by cell index; a handful of faces make a short select chain. */
function perCell(cell: Node<'float'>, pick: (frame: typeof faceFrames[number]) => number) {
  let value: Node<'float'> = float(pick(faceFrames[0]))
  for (let index = 1;index < faceCount;index++) {
    value = select(cell.equal(index), float(pick(faceFrames[index])), value)
  }
  return value
}
/** Closed-form arc length along the knot from the tube seam, in object units (see `speedHarmonics`). */
function arcLength(tubeX: Node<'float'>) {
  const angle = tubeX.mul(TAU * 2)
  let length = angle.mul(speedHarmonics[0])
  for (let k = 1;k < speedHarmonics.length;k++) {
    length = length.add(angle.mul(1.5 * k).sin().mul(speedHarmonics[k] / (1.5 * k)))
  }
  return length
}
/** Face-local coordinates from tube UV; identical math in both shader stages keeps masks and relief aligned. Each face is a sticker on the tube: distances are arc lengths along and around the tube, rotated so that the ears point toward the exhibit's +y as far as the surface allows. Every point belongs to the nearest face center. */
function faceLocal(tube: Node<'vec2'>): FaceLocal {
  const arc = arcLength(tube.x)
  let cell: Node<'float'> = float(0)
  let along: Node<'float'> = float(1e9)
  for (const [index, frame] of faceFrames.entries()) {
    const offset = arc.sub(frame.arc).add(knotLength * 0.5).mod(knotLength).sub(knotLength * 0.5)
    const closer = offset.abs().lessThan(along.abs())
    cell = select(closer, float(index), cell)
    along = select(closer, offset, along)
  }
  const heading = perCell(cell, frame => frame.heading)
  const around = tube.y.sub(heading).add(0.5).fract().sub(0.5).mul(tubeCircumference)
  const upAlong = perCell(cell, frame => frame.upAlong)
  const upAround = perCell(cell, frame => frame.upAround)
// (along, around, normal) is right-handed, so a viewer facing the surface sees `along` to the right when `around` is up.
  const x = along.mul(upAround).sub(around.mul(upAlong))
  const y = along.mul(upAlong).add(around.mul(upAround))
  return {
    cell,
    x,
    y,
  }
}
/** Slow saccades: every few seconds each fellow picks a new spot to stare at and snaps there with a quick ease. */
function glance(cell: Node<'float'>) {
  const clock = time.add(cell.mul(0.83)).div(2.6)
  const slot = clock.floor()
  const ease = clock.fract().smoothstep(0, 0.14)
  const target = (index: Node<'float'>) => vec2(mx_cell_noise_float(vec3(index, cell, 3.5)), mx_cell_noise_float(vec3(index, cell, 8.5))).sub(0.5).mul(0.011)
  return mix(target(slot.sub(1)), target(slot), ease)
}
/** Face-plane components (right, up) of an object-space direction, for a face standing upright on a surface with this normal. Degenerate where the normal is vertical, which no face is; the division is guarded so stray fragments stay finite. */
function faceAxes(normal: Node<'vec3'>, direction: Node<'vec3'>) {
  const upRaw = vec3(0, 1, 0).sub(normal.mul(normal.y))
  const up = upRaw.div(upRaw.length().max(0.001))
  const right = up.cross(normal)
  return vec2(direction.dot(right), direction.dot(up))
}
/** 0 (open) → 1 (closed) blink envelope; cycles are offset per face and every eye is open at t = 0. */
function blink(cell: Node<'float'>) {
  const period = cell.mul(0.37).fract().mul(1.3).add(4.2)
  const duration = 0.26
// The blink sits at the end of each cycle; per-face offsets stay below the open stretch, so nobody blinks at t = 0.
  const local = time.add(cell.mul(0.9).add(2.94)).div(period).fract().mul(period)
  return local.sub(period.sub(duration)).max(0).div(duration).mul(Math.PI).sin().pow2()
}
/** Signed distance (object units, negative inside) of the felt bow tie in face coordinates. */
function bowDistance(x: Node<'float'>, y: Node<'float'>) {
  const ax = x.abs()
  const ay = y.abs()
  const wingInner = 0.012
  const wingOuter = 0.078
  const halfHeight = ax.sub(wingInner).max(0).mul(0.3).add(0.012)
// A concave notch keeps the outer edge from reading as a plain trapezoid.
  const notch = ay.div(0.024).oneMinus().max(0).mul(0.013)
  const wing = ay.sub(halfHeight).max(ax.sub(wingOuter).add(notch)).max(float(wingInner).sub(ax))
  const knot = ax.sub(0.013).max(ay.sub(0.02))
  return wing.min(knot).sub(0.003)
}
const bowCenterY = -0.108
const eyeRadii = vec2(0.0145, 0.021)
const eyeSpacing = 0.038
const eyeCenterY = 0.014
/** Face-space offset from the center of one eye bead (left: −1, right: +1), including the current glance. */
function eyeDelta(local: FaceLocal, side: -1 | 1, look: Node<'vec2'>) {
  const center = vec2(side * eyeSpacing, eyeCenterY).add(look)
  return vec2(local.x, local.y).sub(center)
}
/** Ear-lobe profile 0…1 for both ears (a slow alternating wiggle keeps them alive). The full, rounded lobe reads well even though the tube's 256 segments give each ear only about four vertices along the knot. */
function earProfile(local: FaceLocal) {
  const wiggle = time.mul(1.9).add(local.cell.mul(2.1)).sin().mul(0.0045)
  let profile: Node<'float'> = float(0)
  for (const side of [-1, 1] as const) {
    const ex = local.x.sub(side * 0.056)
    const ey = local.y.sub(0.142).sub(wiggle.mul(side))
    const k = ex.div(0.052).pow2().add(ey.div(0.058).pow2()).oneMinus().max(0)
    profile = profile.add(k.pow(0.75))
  }
  return profile.min(1)
}
const offsets = [-1, 0, 1].flatMap(x => [-1, 0, 1].flatMap(y => [-1, 0, 1].map(z => [x, y, z] as const)))
/** One strand per lattice cell, lying in the tangent plane at a random height around the surface. Each strand is placed with its own parallax, so fibers buried in the felt slide against the surface ones as the viewer moves, and strands above the surface only show up as flyaways. Works in cell units: `q` is already scaled, `view` and `normal` are unit vectors, `facing` is their dot product. */
const strandField = Fn(([q, normal, view, facing, seed, halfWidth]: [Node<'vec3'>, Node<'vec3'>, Node<'vec3'>, Node<'float'>, Node<'float'>, Node<'float'>]) => {
  const base = q.floor().toVar()
  const footprint = q.fwidth().length().max(0.0001).toVar()
  const cover = float(0).toVar()
  const height = float(0).toVar()
  const fly = float(0).toVar()
  for (const offset of offsets) {
    const cell = base.add(vec3(...offset)).add(seed)
    const random = cellNoiseVec3(cell)
    const center = cell.sub(seed).add(random)
    const spin = cellNoiseVec3(cell.add(17.3)).mul(2).sub(1)
    const direction = spin.sub(normal.mul(spin.dot(normal))).normalize()
    const traits = cellNoiseVec3(cell.add(41.7))
    const halfLength = traits.x.mul(0.5).add(0.35)
    const brightness = traits.y.mul(0.5).add(0.5)
// Height of the strand over the surface and the point where the viewing ray crosses that height.
// The parallax shift is capped at one cell so every strand that can cover this point is inside the 3×3×3 neighborhood.
    const h = center.sub(q).dot(normal)
    const toCenter = center.sub(q).sub(view.mul(h.div(facing).clamp(-1, 1)))
    const inPlane = toCenter.sub(normal.mul(toCenter.dot(normal)))
    const along = inPlane.dot(direction).clamp(halfLength.negate(), halfLength)
    const distance = inPlane.sub(direction.mul(along)).length()
    const coverage = distance.smoothstep(halfWidth.sub(footprint), halfWidth.add(footprint)).oneMinus()
// Buried strands darken with depth; strands hovering above the surface become flyaways.
    const buried = h.smoothstep(-1.2, -0.5)
    const surfaceWeight = buried.mul(h.smoothstep(0.12, 0.45).oneMinus())
    const shade = brightness.mul(h.min(0).mul(2.2).exp())
    const flyWeight = h.smoothstep(0.1, 0.45).mul(h.smoothstep(0.8, 1.15).oneMinus())
    cover.assign(cover.max(coverage.mul(shade).mul(surfaceWeight)))
    height.assign(height.max(coverage.mul(surfaceWeight).mul(h.mul(0.6).add(1).clamp(0.4, 1))))
    fly.assign(fly.max(coverage.mul(brightness).mul(flyWeight)))
  }
  return vec3(cover, height, fly)
})
type FeltLayer = {
/** Brightest strand coverage 0…1 near the surface, shaded by depth. */
  cover: Node<'float'>
/** Coverage of strands floating above the surface, for silhouette fuzz. */
  fly: Node<'float'>
/** Strand relief for bump mapping, 0…1. */
  height: Node<'float'>
/** 1 where strands are wider than a pixel, fading to 0 as they alias away. */
  resolved: Node<'float'>
}
/** A layer of matted wool strands around the surface at `scale` cells per object unit, in object space, seamless and independent of any tangent frame. Unresolved strands settle to their mean coverage rather than shimmering. */
function feltStrands(q: Node<'vec3'>, normal: Node<'vec3'>, view: Node<'vec3'>, facing: Node<'float'>, scale: number, seed: number, halfWidth: number, mean: number): FeltLayer {
  const scaled = q.mul(scale)
  const field = strandField(scaled, normal, view, facing, float(seed), float(halfWidth))
  const footprint = scaled.fwidth().length()
  const resolved = footprint.div(halfWidth * 2).smoothstep(0.5, 1.6).oneMinus()
  return {
    cover: mix(float(mean), field.x, resolved),
    height: field.y.mul(resolved),
    fly: field.z.mul(resolved),
    resolved,
  }
}
/** Soft mottling of compacted wool – far larger than any strand, so the body never looks machine-turned. */
function feltMottle(q: Node<'vec3'>) {
  return mx_fractal_noise_float(q.mul(38), 3, 2.1, 0.55).mul(0.5).add(0.5)
}
// Finite-difference steps in tube UV, about 4 mm of surface in both directions.
const stepAlong = 0.0006
const stepAround = 0.005
/** Object-space point of the stuffed surface at tube UV: felt lumps, slow breathing and the two ears of every face. */
function plushPoint(tube: Node<'vec2'>) {
  const frame = knotFrame(tube)
  const local = faceLocal(tube)
  const ears = earProfile(local)
// Loose stuffing: soft lumps far larger than any fiber, so the silhouette never looks machine-turned.
  const lumps = mx_noise_float(frame.position.mul(9)).mul(0.003)
// A slow swell travels along the body; a periodic phase keeps the tube seam watertight.
  const breathing = time.mul(1.4).add(tube.x.mul(TAU * 2)).sin().mul(0.0025)
  const height = ears.mul(earHeight).add(lumps).add(breathing)
  return {
    ears,
    frame,
    position: frame.position.add(frame.normal.mul(height)),
  }
}
/** Analytic displaced surface for the vertex stage. The normal comes from finite differences of the same displacement, so ears and lumps shade smoothly even where the 256×64 tessellation is coarse. */
function plushSurface(tube: Node<'vec2'>) {
  const base = plushPoint(tube)
  const along = plushPoint(tube.add(vec2(stepAlong, 0))).position.sub(base.position)
  const around = plushPoint(tube.add(vec2(0, stepAround))).position.sub(base.position)
  const raw = along.cross(around).normalize()
  const normal = raw.mul(raw.dot(base.frame.normal).sign())
  return {
    ears: base.ears,
    normal,
    position: base.position,
  }
}
/** Anti-aliased coverage of a signed distance in object units. */
function fill(distance: Node<'float'>) {
  const aa = distance.fwidth().max(0.00002)
  return distance.smoothstep(aa.negate(), aa).oneMinus()
}
/** Needle-felted wool with a soirée of faces: glossy bead eyes that blink and glance, black felt bow ties and stuffed ears. The wool is built from individual strands at two scales, lying at different depths with real parallax, so leaning in reveals a mat of fibers rather than a texture; stray strands fray the silhouette, and the whole body breathes. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const tube = uv()
// Geometry: ears, lumps and breathing are displaced in the vertex stage; the smooth displaced normal is interpolated from there.
    const surface = plushSurface(tube)
    this.positionNode = surface.position
    const p = positionLocal
    const normalLocal = vertexStage(surface.normal).normalize()
    const ears = vertexStage(surface.ears)
    const normalView = transformNormalToView(normalLocal).normalize()
    const viewDirection = positionViewDirection
    const facing = normalView.dot(viewDirection).clamp()
    const grazing = facing.oneMinus()
    const cameraLocal = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz
    const view = cameraLocal.sub(p).normalize()
    const facingLocal = view.dot(normalLocal).max(0.3)
    const distance = positionView.length()
    const near = distance.smoothstep(1.2, 5).oneMinus()
    const intimate = distance.smoothstep(0.7, 2.4).oneMinus()
// Face features in object units around each face center.
    const local = faceLocal(tube)
// Idle glances; when a visitor comes close, the beads drift toward them instead.
    const toward = faceAxes(normalLocal, view).mul(0.009)
    const look = mix(glance(local.cell), toward, intimate.mul(0.85))
    const lid = blink(local.cell)
    let eye: Node<'float'> = float(0)
    let beadHeight: Node<'float'> = float(0)
    let pressed: Node<'float'> = float(0)
    for (const side of [-1, 1] as const) {
      const delta = eyeDelta(local, side, look)
// Eyelids are plain felt closing over the bead – the bead simply shrinks to a dark seam.
      const closing = lid.mul(0.9).oneMinus()
      const normalized = vec2(delta.x, delta.y.div(closing)).div(eyeRadii)
      const radial = normalized.length()
      const coverage = fill(radial.sub(1).mul(eyeRadii.x))
      eye = eye.max(coverage)
// A flattened hemisphere: the slope reaches 45° well inside the rim, so reflections wander across the bead as you move.
      const dome = radial.pow2().oneMinus().max(0).sqrt()
      beadHeight = beadHeight.add(dome.mul(coverage).mul(0.011))
// Felt is compressed into a shallow ring around every bead.
      pressed = pressed.max(radial.smoothstep(1.05, 1.9).oneMinus().mul(coverage.oneMinus()))
    }
    const ringHeight = pressed.mul(-0.0014)
    const bowField = bowDistance(local.x, local.y.sub(bowCenterY))
    const bow = fill(bowField)
    const bowHeight = bowField.smoothstep(-0.0035, 0.0035).oneMinus().mul(0.0032)
    const bowShadow = bowField.smoothstep(0, 0.014).oneMinus().mul(bow.oneMinus()).mul(0.3)
// Wool: fine strands and coarse strands, each lying at its own depth around the surface.
    const fine = feltStrands(p, normalLocal, view, facingLocal, 520, 0, 0.12, 0.3)
    const coarse = feltStrands(p, normalLocal, view, facingLocal, 150, 11, 0.1, 0.25)
    const mottle = feltMottle(p)
    const strands = fine.cover.mul(0.6).add(coarse.cover.mul(0.7)).clamp()
    const fuzz = strands.mul(0.36).add(mottle.mul(0.16)).add(0.7)
// Stray strands hovering above the mat only show against the silhouette.
    const flyaway = fine.fly.max(coarse.fly).mul(grazing.pow(2))
    const feltHeight = fine.height.mul(0.0006).add(coarse.height.mul(0.0012))
    const felt = eye.oneMinus()
// Colors are linear albedo; the wool brightens at grazing angles because light scatters through loose fibers.
    const pink = mix(color(hsl.integer(5, 99, 59)), color(hsl.integer(355, 100, 69)), grazing.pow(1.6).mul(0.5))
    const pinkFelt = pink.mul(fuzz).add(color(hsl.integer(351, 100, 89)).mul(flyaway).mul(0.6))
    const blackFelt = mix(color(hsl.integer(315, 12, 5.5)), color(hsl.integer(321, 11, 18)), grazing.pow(1.6).mul(0.6)).mul(fuzz.mul(0.9).add(0.2)).add(color(hsl.integer(319, 11, 36)).mul(flyaway).mul(0.35))
    const surfaceColor = mix(pinkFelt, blackFelt, bow)
    this.colorNode = mix(surfaceColor, color(hsl.integer(310, 27, 3)), eye)
    this.metalness = 0
// Bead eyes are glossy black plastic.
    this.roughnessNode = mix(mix(float(0.92), float(0.96), bow), float(0.22), eye)
    this.specularIntensityNode = mix(float(0.22), float(0.7), eye)
    this.ior = 1.5
// Sheen is the fuzz: bright at grazing incidence, dyed with the wool.
    this.sheenNode = mix(color(hsl.integer(353, 100, 83.6)).mul(flyaway.mul(0.45).add(0.75)), color(hsl.integer(335, 12, 23)).mul(0.6), bow).mul(felt)
    this.sheenRoughnessNode = float(0.78)
    const beadNormal = proceduralNormal(beadHeight, 1)
    const relief = feltHeight.mul(felt).add(beadHeight).add(ringHeight).add(bowHeight)
    this.normalNode = proceduralNormal(relief, 1)
// Creases: the ear foot, the pressed ring around each bead, the shadow under the bow and the depth between strands.
    const earFoot = ears.smoothstep(0, 0.2).mul(ears.smoothstep(0.2, 0.6).oneMinus()).mul(0.22)
    this.aoNode = float(1).sub(earFoot).sub(pressed.mul(0.3)).sub(bowShadow).sub(strands.oneMinus().mul(0.15).mul(near))
// The silhouette frays into stray strands; alpha-to-coverage keeps it anti-aliased. Faces stay intact.
    const edge = facing.smoothstep(0.08, 0.4).oneMinus()
    const strandCover = coarse.cover.mul(1.4).max(coarse.fly.mul(1.6)).clamp()
    this.opacityNode = edge.mul(strandCover.oneMinus()).mul(felt).mul(bow.oneMinus()).oneMinus()
    this.alphaTest = 0.5
    this.alphaToCoverage = true
// Two gallery lamps above the visitor, mirrored by the beads: a crisp catchlight and a soft window travel as you walk.
    const catchlight = (lamp: Node<'vec3'>, sharpness: number) => beadNormal.dot(lamp.add(viewDirection).normalize()).clamp().pow(sharpness)
    const sparkle = catchlight(vec3(-0.32, 0.55, 0.77).normalize(), 900).mul(1.2).add(catchlight(vec3(0.45, 0.3, 0.84).normalize(), 60).mul(0.08))
// From across the room the point highlight is smaller than a pixel; a steady glint keeps the beads glossy.
    const glint = beadNormal.dot(viewDirection).clamp().pow(5).mul(near.oneMinus()).mul(0.12)
    this.emissiveNode = color(hsl.integer(64, 100, 97.4)).mul(sparkle.mul(intimate.mul(0.5).add(0.5)).add(glint)).mul(eye)
  }
}
