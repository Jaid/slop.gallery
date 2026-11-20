import type {Triple} from '../../lib/Triple.ts'
import type {Node, Texture} from 'three/webgpu'

import {atan, cameraPosition, cameraViewMatrix, color, float, mix, modelWorldMatrixInverse, mx_cell_noise_float, mx_fractal_noise_float, mx_noise_float, positionView, time, transformNormalToView, uv, vec2, vec3, vec4} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {knotCurve} from '../../lib/knotCurve.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {add, cross, dot, length, normalize, scale, sub} from '../../lib/tripleMath.ts'
import knotData from './data.ts'

/** Sum of scaled vectors. */
const combine = (...terms: Array<[Triple, number]>) => terms.reduce<Triple>((sum, [vector, weight]) => add(sum, scale(vector, weight)), [0, 0, 0])
/** CPU-side anatomy of the felt prince. Everything here is evaluated once at import time and baked into the node graph as constants, so the GPU only ever sees plain vectors and numbers. “Knot space” is the space of the stock TorusKnotGeometry. The face frame (right, up, forward) is anchored at the apex of one outer lobe, which grows into the head; the material re-poses the knot so that frame becomes object x, y and z. */
const tubeRadius = 0.13
/** Mesh parameter of the lobe apex that grows into the head (lobes sit at u = 0, ⅓, ⅔; 0 is the UV seam). */
const headU = 1 / 3
/** Exactly the (2, 3) torus knot centerline used by three’s TorusKnotGeometry and src/lib/knotCurve.ts. */
function knotPoint(angle: number): Triple {
  const radius = (2 + Math.cos(1.5 * angle)) * 0.225
  return [radius * Math.cos(angle), radius * Math.sin(angle), Math.sin(1.5 * angle) * 0.225]
}
/** Chibi proportions: the body knot shrinks toward the head while the tube keeps its plump radius. The closest strands of the knot sit 0.374 apart, so 0.85 still leaves a gap between the tubes. */
const bodyScale = 0.85
const pivot = knotPoint(headU * TAU * 2)
const bodyPoint = (angle: number) => combine([pivot, 1 - bodyScale], [knotPoint(angle), bodyScale])
/** The mesh’s own ring frame (three samples the curve 0.01 radians ahead and crosses with P1 + P2), on the shrunken body. */
function knotRing(u: number) {
  const angle = u * TAU * 2
  const point = knotPoint(angle)
  const ahead = knotPoint(angle + 0.01)
  const tangent = sub(ahead, point)
  const binormal = cross(tangent, combine([point, 1], [ahead, 1]))
  const normal = cross(binormal, tangent)
  return {
    point: bodyPoint(angle),
    tangent: normalize(tangent),
    binormal: normalize(binormal),
    normal: normalize(normal),
  }
}
const apex = knotRing(headU)
/** Face frame in knot space: up is the lobe’s outward radial, forward is the side that faces the gallery. */
const up = apex.normal
const forward = combine([apex.binormal, Math.sign(apex.binormal[2])])
const right = normalize(cross(up, forward))
/** Face-frame coordinates → knot space, relative to the lobe apex. */
const face = (x: number, y: number, z: number) => combine([apex.point, 1], [right, x], [up, y], [forward, z])
/** Knot space → face-frame coordinates relative to the lobe apex. */
const toFace = (point: Triple): Triple => {
  const offset = sub(point, apex.point)
  return [dot(offset, right), dot(offset, up), dot(offset, forward)]
}
/** Arc length along the shrunken centerline: s(u) = total·u + Σ c_k·sin(2π·3k·u). The knot’s speed varies by 1.9×, so stitches spaced in u would bunch up; the threefold-symmetric sine series undoes that and vanishes at u = 0 and 1, so whole-numbered stitch counts close seamlessly. */
const arcLength = (() => {
  const samples = 6000
  const speeds = Array.from({length: samples}, (_, index) => {
    const u = (index + 0.5) / samples
    return length(sub(bodyPoint((u + 1e-6) * TAU * 2), bodyPoint((u - 1e-6) * TAU * 2))) / 2e-6
  })
  const total = speeds.reduce((sum, speed) => sum + speed, 0) / samples
  let running = 0
  const residual = speeds.map(speed => {
    running += speed / samples
    return running - speed / samples / 2
  })
  const coefficients = Array.from({length: 6}, (_, k) => {
    let sum = 0
    for (const [index, value] of residual.entries()) {
      const u = (index + 0.5) / samples
      sum += (value - total * u) * Math.sin(TAU * 3 * (k + 1) * u)
    }
    return 2 * sum / samples
  })
  return {
    total,
    coefficients,
  }
})()
/** The pillow head: an ellipsoid in the face frame whose shell the tube is inflated to fill. */
const head = {
  center: face(0, 0.02, 0),
  radii: [0.4, 0.255, 0.2] as Triple,
}
/** Felt eye bumps: spheres that bulge above the crown, with a white felt disc and a glossy safety eye. */
const eyeRadius = 0.128
/** Angular radius of the white felt disc and of the resting pupil on the eye sphere. */
const whiteAngle = 0.72
const pupilAngle = 0.46
/** Largest pupil dilation (when a visitor leans in) and the amplitude of the idle saccades, in radians. */
const maxDilation = 1.08
const saccadeAmplitude = 0.025
/** How far the pupil dome stands proud of the felt. */
const pupilRise = 0.02
/** Stuffing fillet where the eye bumps meet the head. */
const eyeFillet = 0.045
const eyes = ([-1, 1] as const).map(side => {
  const center = face(side * 0.198, 0.21, 0.05)
  const look = normalize(combine([forward, 0.95], [up, 0.22], [right, side * 0.16]))
  const lidUp = normalize(combine([up, 1], [look, -dot(up, look)]))
  return {
    side,
    center,
    look,
    lidUp,
    lidSide: normalize(cross(lidUp, look)),
  }
})
/** How far the pupils may roll toward the viewer: even fully dilated and mid-saccade, the dome keeps clear of the felt rim. */
const gazeLimit = whiteAngle - pupilAngle * maxDilation - saccadeAmplitude - 0.025
/** Bow tie anchor under the chin, with its tangent frame; `normal` is the outward axis it is raised along. */
const bow = (() => {
  const normal = normalize(combine([forward, 0.8], [up, -0.6]))
  const [rx, ry, rz] = head.radii
  const local = [dot(normal, right) / rx, dot(normal, up) / ry, dot(normal, forward) / rz]
  const exit = 1 / Math.hypot(local[0], local[1], local[2])
  return {
    center: combine([head.center, 1], [normal, exit]),
    normal,
    right,
    up: normalize(cross(normal, right)),
  }
})()
/** Rosy cheeks that blush when a visitor leans in: face-frame center offsets and ellipse radii. */
const cheeks = {
  x: 0.25,
  y: -0.03,
  radii: [0.07, 0.042] as const,
}
/** Where the knot passes over itself: both strands of each crossing, for soft contact shading. */
const crossingStrands = [1, 3, 5].flatMap(index => {
  const angle = Math.PI / 3 * index
  return [angle, angle + TAU].map(strandAngle => {
    const point = bodyPoint(strandAngle)
    return {
      point,
      tangent: normalize(sub(bodyPoint(strandAngle + 0.001), point)),
    }
  })
})
/** The two lower lobes become webbed feet: apex parameter, toe direction (around the tube) and toe spacing. */
const feet = [0, 2 / 3].map(u => {
  const ring = knotRing(u)
// The toes point forward and a little down, where the visitor can see them.
  const toward = normalize(combine([forward, 1], [up, -0.45]))
  const around = Math.atan2(dot(toward, ring.binormal), -dot(toward, ring.normal)) / TAU
  return {
    u,
    around: (around + 1) % 1,
    speed: length(sub(knotRing(u + 1e-5).point, knotRing(u - 1e-5).point)) / 2e-5,
  }
})
/** The satin care label, sewn where the rear loop faces straight back: curve u, around-the-tube v, arc speed and half-size (along × around). */
const label = (() => {
  const u = 0.94
  const ring = knotRing(u)
  const toward = combine([forward, -1], [up, 0.15])
  const around = Math.atan2(dot(toward, ring.binormal), -dot(toward, ring.normal)) / TAU
  return {
    u,
    around: (around + 1) % 1,
    speed: length(sub(knotRing(u + 1e-5).point, knotRing(u - 1e-5).point)) / 2e-5,
    half: [0.032, 0.05] as const,
  }
})()
/** Vertical extent of the posed figure (face-frame y relative to the apex), so it can be centered. */
const bounds = (() => {
  let low = Infinity
  let high = -Infinity
  for (let index = 0;index < 2000;index++) {
    const [, y] = toFace(bodyPoint(index / 2000 * TAU * 2))
    low = Math.min(low, y - tubeRadius)
    high = Math.max(high, y + tubeRadius)
  }
  for (const eye of eyes) {
    high = Math.max(high, toFace(eye.center)[1] + eyeRadius)
  }
  return {
    low,
    high,
  }
})()
/** Object-space translation (applied after re-posing). Visitors look at the object origin, so the figure sits a little lower than its bounding box would suggest: close views then favor the face. */
const faceBias = 0.08
const lift: Triple = [0, -(bounds.low + bounds.high) / 2 - faceBias - dot(apex.point, up), 0]
/** Wing reach, the pinch at the knot and the flare at the tips (half-heights), in object units. */
const wingReach = 0.19
const wingPinch = 0.026
const wingFlare = 0.072
const wingHeight = 0.05
/** The center knot: an upright oval wrapped over the pinch. */
const knotRadii = [0.036, 0.05] as const
const knotHeight = 0.062
/** A smooth step that collapses to a hard edge as softness reaches zero. */
const soft = (value: Node<'float'>, softness: number) => value.div(softness).add(0.5).clamp()
/** A glossy black bow tie as a height field in the plane under the chin. Two pillowy wings flare from a pinched middle, each with two folds radiating from the knot, and an oval knot rides on top. `offset` is the surface point relative to the bow anchor (knot space). */
function bowRelief(offset: Node<'vec3'>, softness: number) {
  const x = offset.dot(vec3(...bow.right))
  const y = offset.dot(vec3(...bow.up))
  const z = offset.dot(vec3(...bow.normal))
// Only the felt directly under the bow is raised – never the back of the head or a passing strand.
  const nearPlane = z.abs().smoothstep(0.07, 0.11).oneMinus()
  const ax = x.abs()
  const reach = ax.div(wingReach)
// Flared outline: pinched at the knot, widest just before the rounded tip.
  const flare = reach.smoothstep(0, 0.82)
  const halfHeight = float(wingPinch).add(flare.mul(wingFlare - wingPinch)).mul(reach.smoothstep(0.86, 1.02).mul(0.35).oneMinus())
  const across = y.div(halfHeight)
// The tip term keeps growing past the reach, so the outline is closed.
  const tip = reach.sub(0.55).div(0.45).max(0)
  const ellipse = across.mul(across).add(tip.mul(tip))
  const wingCoverage = soft(float(1).sub(ellipse).mul(halfHeight), softness)
// Pillow profile, with the cloth drawn tight where it disappears under the knot.
  const loft = float(1).sub(ellipse).max(0).sqrt().mul(reach.smoothstep(0.05, 0.4).mul(0.75).add(0.25))
  const folds = across.sub(0.42).div(0.16).pow2().negate().exp().add(across.add(0.4).div(0.16).pow2().negate().exp()).mul(reach.smoothstep(0.15, 0.55)).mul(reach.smoothstep(0.75, 0.98).oneMinus())
  const wing = loft.mul(wingHeight).mul(wingCoverage).sub(folds.mul(0.0055).mul(wingCoverage))
  const kx = x.div(knotRadii[0])
  const ky = y.div(knotRadii[1])
  const knotEllipse = kx.mul(kx).add(ky.mul(ky))
  const knotCoverage = soft(float(1).sub(knotEllipse).mul(knotRadii[0]), softness)
  const knot = float(1).sub(knotEllipse).max(0).sqrt().mul(knotHeight).mul(knotCoverage)
// Horizontal wraps across the knot, where the fabric gathers.
  const gather = ky.mul(Math.PI * 1.5).cos().mul(0.0018).mul(knotCoverage)
  const height = wing.max(knot.add(gather)).mul(nearPlane)
  return {
    height,
    coverage: wingCoverage.max(knotCoverage).mul(nearPlane),
    fold: folds.mul(wingCoverage).mul(knotCoverage.oneMinus()),
  }
}
/** Surface-gradient bump mapping around an arbitrary view-space base normal, for heights in object units. Unnormalized derivatives keep the strength independent of distance and resolution. */
function bump(normal: Node<'vec3'>, height: Node<'float'>) {
  const dx = positionView.dFdx()
  const dy = positionView.dFdy()
  const rx = dy.cross(normal)
  const ry = normal.cross(dx)
  const determinant = dx.dot(rx)
  const gradient = rx.mul(height.dFdx()).add(ry.mul(height.dFdy())).mul(determinant.sign()).div(determinant.abs().max(1e-14))
  return normal.sub(gradient).normalize()
}
/** Signed distance between two periodic coordinates, in −0.5…0.5. */
const wrappedCare = (value: Node<'float'>) => value.add(0.5).fract().sub(0.5)
/** Rounded-rectangle signed distance (negative inside). */
const roundedBox = (p: Node<'vec2'>, half: readonly [number, number], corner: number) => {
  const q = p.abs().sub(vec2(half[0] - corner, half[1] - corner))
  return q.max(0).length().add(q.x.max(q.y).min(0)).sub(corner)
}
/** Coverage of `distance < 0`, filtered over one pixel. */
const inside = (distance: Node<'float'>) => {
  const width = distance.fwidth().max(1e-5)
  return distance.div(width).mul(-1).add(0.5).clamp()
}
type EyeInput = {
/** Pupil direction for each eye, from `gaze`. */
  aims: Array<Node<'vec3'>>
/** Vertical drift of the eye bumps while breathing. */
  breathLift: Node<'vec3'>
/** Pupil dilation factor around 1. */
  dilation: Node<'float'>
/** Lid closure, 0 open … 1 shut. */
  lidClosure: Node<'float'>
/** Fragment position on the plush surface (knot space). */
  point: Node<'vec3'>
}

/** The sewn-in satin care label on the back of one foot – the kind every plush has and every child eventually cuts off. Tiny rows of printed “text” resolve only when a visitor walks around and leans in. Coordinates are arc lengths on the tube (`u`, `v` are the warped mesh parameters). */
function careLabel(u: Node<'float'>, v: Node<'float'>) {
  const along = wrappedCare(u.sub(label.u)).mul(label.speed)
  const around = wrappedCare(v.sub(label.around)).mul(TAU * tubeRadius)
  const p = vec2(along, around)
  const shape = roundedBox(p, label.half, 0.006)
  const mask = inside(shape)
// Satin hems: the folded edge at both short ends and the stitch line that holds it to the felt.
  const hem = shape.add(0.0045).abs().smoothstep(0.0008, 0.0016).oneMinus().mul(mask)
  const stitchLine = around.add(label.half[1] - 0.007).abs().smoothstep(0.0007, 0.0014).oneMinus().mul(along.mul(260).fract().sub(0.5).abs().smoothstep(0.2, 0.3).oneMinus()).mul(mask)
// Printed rows: a big “logo” line and five rows of small words, each word a cell-noise length.
  const row = around.sub(label.half[1] - 0.019).div(-0.0072)
  const rowIndex = row.floor()
  const inRow = row.fract().sub(0.5).abs().smoothstep(0.17, 0.25).oneMinus()
  const wordCell = along.mul(rowIndex.equal(0).select(float(70), float(150))).add(rowIndex.mul(3.7))
  const word = mx_cell_noise_float(vec2(wordCell.floor(), rowIndex)).step(0.78).oneMinus()
  const gap = wordCell.fract().smoothstep(0.82, 0.9).oneMinus()
  const rows = rowIndex.greaterThanEqual(0).select(float(1), float(0)).mul(rowIndex.lessThan(6).select(float(1), float(0)))
  const margin = along.abs().smoothstep(label.half[0] - 0.012, label.half[0] - 0.009).oneMinus()
  const ink = inRow.mul(word).mul(gap).mul(rows).mul(margin).mul(mask)
// The label stands a hair proud of the felt, bulging softly at its center.
  const height = mask.mul(0.0012).add(hem.mul(0.0004)).sub(stitchLine.mul(0.0003))
  return {
    mask,
    ink,
    hem,
    height,
  }
}
/** Coverage of `value > edge`, filtered over one pixel. */
const above = (value: Node<'float'>, edge: Node<'float'> | number) => {
  const width = value.fwidth().mul(0.75).max(0.0005)
  return value.sub(edge).div(width).mul(0.5).add(0.5).clamp()
}
/** The felt-and-plastic eyes: a white felt disc on each eye bump, a domed glossy safety eye that rolls toward the viewer and a green felt lid that sweeps down when he blinks. Masks never overlap between the two eyes, so they are combined with max/sum. */
function eyeLayers({point, aims, lidClosure, breathLift, dilation}: EyeInput) {
  let white: Node<'float'> = float(0)
  let pupil: Node<'float'> = float(0)
  let lid: Node<'float'> = float(0)
  let lidEdge: Node<'float'> = float(0)
  let lidHeight: Node<'float'> = float(0)
  let rim: Node<'float'> = float(0)
  let pupilNormal: Node<'vec3'> = vec3(0, 0, 1)
  for (const [index, eye] of eyes.entries()) {
    const center = vec3(...eye.center).add(breathLift)
    const offset = point.sub(center)
    const distance = offset.length()
    const direction = offset.div(distance.max(1e-5))
// Only the eyeball itself, not the stuffed fillet around it.
    const onBall = distance.sub(eyeRadius).abs().smoothstep(0.004, 0.009).oneMinus()
    const look = vec3(...eye.look)
    const facing = direction.dot(look)
    const disc = above(facing, Math.cos(whiteAngle)).mul(onBall)
// The pupil cap: a sphere of radius `radius` centered `along` the aim, meeting the eyeball at `angle`.
    const aim = aims[index]
    const angle = dilation.mul(pupilAngle)
    const top = eyeRadius + pupilRise
    const along = float(top * top - eyeRadius * eyeRadius).div(float(top).sub(angle.cos().mul(eyeRadius)).mul(2))
    const radius = float(top).sub(along)
    const cosine = direction.dot(aim)
    const sine2 = cosine.mul(cosine).oneMinus()
    const reach = cosine.mul(along).add(radius.mul(radius).sub(along.mul(along).mul(sine2)).max(0).sqrt())
    const dome = direction.mul(reach).sub(aim.mul(along)).normalize()
    const cap = above(cosine, angle.cos()).mul(disc)
// The lid: its edge is a gentle arc that drops from above the disc to below it, curving into a smile.
    const upness = direction.dot(vec3(...eye.lidUp))
    const sideways = direction.dot(vec3(...eye.lidSide))
    const reachUp = Math.sin(whiteAngle) + 0.06
    const edge = float(reachUp).sub(lidClosure.mul(reachUp * 2 + 0.06)).add(sideways.mul(sideways).mul(lidClosure.mul(1.6).add(0.15)))
    const covered = above(upness, edge).mul(onBall.max(disc))
    const edgeLine = upness.sub(edge).abs().smoothstep(0, 0.03).oneMinus().mul(lidClosure.smoothstep(0.02, 0.1)).mul(disc)
    white = white.add(disc)
    pupil = pupil.add(cap)
    lid = lid.add(covered.mul(lidClosure.smoothstep(0, 0.04)))
    lidEdge = lidEdge.add(edgeLine)
// Domed lid: thickens toward its edge so it reads as a felt flap, not paint.
    lidHeight = lidHeight.add(covered.mul(upness.sub(edge).smoothstep(0, 0.05).mul(-0.0018).add(0.0028)).mul(lidClosure.smoothstep(0, 0.04)))
// A thin band of green felt just outside the disc, where its cut edge casts a hairline shadow.
    rim = rim.add(above(facing, Math.cos(whiteAngle + 0.03)).sub(disc).max(0).mul(onBall))
    pupilNormal = cap.greaterThan(0).select(dome, pupilNormal)
  }
  return {
    white,
    pupil,
    lid,
    lidEdge,
    lidHeight,
    rim,
    pupilNormal,
  }
}
/** Fiber lay directions: felt is non-woven, so a handful of skewed orientations reads as random. */
const fiberAxes: Array<Triple> = [[0.82, 0.31, -0.48], [-0.27, 0.91, 0.32], [0.36, -0.42, 0.83], [-0.71, -0.52, -0.47], [0.12, 0.68, 0.72], [0.94, -0.2, 0.27]]
/** Pressed wool felt. Returns a height (object units), an albedo factor around 1 and the fiber and clump fields. `footprint` is the pixel size in object units; detail below two pixels settles to its mean, so distant felt neither shimmers nor changes tone. */
function felt(p: Node<'vec3'>, footprint: Node<'float'>) {
// Matted clumps and the uneven density of stuffed felt, readable from across the room.
  const mottle = mx_fractal_noise_float(p.mul(11), 3, 2.1, 0.5)
  const clumps = mx_fractal_noise_float(p.mul(48).add(mottle), 2, 2.2, 0.5)
// Individual fibers: short, curly strands in several orientations, domain-warped so none run straight.
  const curl = vec3(mx_noise_float(p.mul(110)), mx_noise_float(p.mul(110).add(17.3)), mx_noise_float(p.mul(110).add(41.9))).mul(0.0045)
  const q = p.add(curl)
  let fibers: Node<'float'> = float(0)
  for (const [index, axis] of fiberAxes.entries()) {
    const direction = vec3(...axis).normalize()
// Squash the lattice along the fiber so each zero-crossing becomes a long, thin strand.
    const across = q.sub(direction.mul(q.dot(direction).mul(0.9)))
    const strand = mx_noise_float(across.mul(430).add(index * 7.1)).abs().oneMinus().pow(18)
    const life = mx_noise_float(q.mul(60).add(index * 3.3)).smoothstep(-0.2, 0.4)
    fibers = fibers.max(strand.mul(life))
  }
// A fine matted grain between the strands.
  const grain = mx_noise_float(q.mul(900))
  const fineVisible = footprint.smoothstep(0.0005, 0.0018).oneMinus()
  const clumpVisible = footprint.smoothstep(0.0025, 0.009).oneMinus()
// Mean-subtracted detail keeps the tone steady as it dissolves with distance.
  const fiberDetail = fibers.sub(0.16).mul(fineVisible)
  const grainDetail = grain.mul(fineVisible)
  const clumpDetail = clumps.mul(clumpVisible)
  return {
    height: mottle.mul(0.004).add(clumpDetail.mul(0.0018)).add(fiberDetail.mul(0.0011)).add(grainDetail.mul(0.0003)),
    albedo: mottle.mul(0.1).add(clumpDetail.mul(0.12)).add(fiberDetail.mul(0.32)).add(grainDetail.mul(0.06)).add(1),
    fibers: fiberDetail,
    mottle,
  }
}
/** Loose fibers that stand proud of the felt and fray the silhouette. `facing` is |N·V| of the inflated shell, `radius` the local radius of curvature and `fuzz` the shell thickness. Returns opacity. */
function fuzzOpacity(p: Node<'vec3'>, normal: Node<'vec3'>, facing: Node<'float'>, radius: Node<'float'>, fuzz: number) {
// Rays steeper than this hit the dense core under the fuzz layer.
  const core = float(1).sub(radius.div(radius.add(fuzz)).pow2()).sqrt()
// Hairs: noise squashed along the surface normal, so strands point outward from the silhouette.
  const q = p.sub(normal.mul(p.dot(normal).mul(0.85)))
  const hairs = mx_noise_float(q.mul(900)).mul(0.6).add(mx_noise_float(q.mul(340).add(9.1)).mul(0.4))
  const reach = facing.div(core.max(0.001))
  return reach.sub(hairs.mul(0.55).add(0.62).oneMinus()).mul(3).add(0.5)
}
/** Object space ← knot space: rows are the face frame, so the head points up and the face looks down +z. */
const toObject = (vector: Node<'vec3'>) => vec3(vector.dot(vec3(...right)), vector.dot(vec3(...up)), vector.dot(vec3(...forward)))
/** Knot space ← object space (the transpose of the re-posing rotation). */
const toKnot = (vector: Node<'vec3'>) => vec3(...right).mul(vector.x).add(vec3(...up).mul(vector.y)).add(vec3(...forward).mul(vector.z))
/** Re-posed and centered: knot space → object space position. */
const placeInObject = (point: Node<'vec3'>) => toObject(point).add(vec3(...lift))
/** The viewer, expressed in the knot space every anatomical constant lives in. */
const viewerKnot = () => toKnot(modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(vec3(...lift)))
const hash = (value: Node<'float'>, seed: number) => value.mul(12.9898).add(seed).sin().mul(43_758.5453).fract()
/** One quick lid stroke: snaps shut in 70 ms, rests, then lifts lazily. */
const lidStroke = (elapsed: Node<'float'>) => elapsed.smoothstep(0, 0.07).mul(elapsed.smoothstep(0.11, 0.26).oneMinus())
/** Blinks on an irregular but deterministic schedule: each 3.2 s window holds one blink, sometimes a double blink, and occasionally none. The first window blinks well inside the 2 s preview loop, so the loop stays seamless. */
function blink() {
  const period = 3.2
  const cycle = time.div(period).floor()
  const local = time.sub(cycle.mul(period))
  const start = cycle.equal(0).select(float(0.85), hash(cycle, 1.7).mul(2).add(0.4))
  const enabled = cycle.equal(0).select(float(1), hash(cycle, 7.31).smoothstep(0.12, 0.14))
  const twice = cycle.equal(0).select(float(0), hash(cycle, 3.77).step(0.4))
  const first = lidStroke(local.sub(start))
  const second = lidStroke(local.sub(start).sub(0.34)).mul(twice)
  return first.max(second).mul(enabled)
}
/** Slow belly breath with a faint flutter; both periods divide the 2 s preview loop. */
function breath() {
  const phase = time.mul(TAU / 2)
  return phase.sin().mul(0.85).add(phase.mul(2).add(0.6).sin().mul(0.15))
}
/** A point in the unit disc per slot, scaled to the saccade amplitude. */
const saccadePoint = (slot: Node<'float'>) => {
  const angle = hash(slot, 2.1).mul(TAU)
  return vec3(angle.cos(), angle.sin(), 0).mul(hash(slot, 5.3).sqrt().mul(saccadeAmplitude))
}
/** Tiny fixational saccades: three quick hops per 2 s loop, so the eyes never look painted on. */
function saccade() {
  const step = time.mul(1.5)
  const index = step.floor().mod(3)
  const settle = step.fract().smoothstep(0, 0.04)
  const previous = index.add(2).mod(3)
  return mix(saccadePoint(previous), saccadePoint(index), settle)
}
/** Where each pupil points (knot space). The safety eyes roll toward the viewer and saturate smoothly at the felt rim, so the prince keeps watching whoever walks around him. Closer visitors dilate them. */
function gaze(viewer: Node<'vec3'>) {
  const jitter = saccade()
  return eyes.map(eye => {
    const look = vec3(...eye.look)
    const toViewer = viewer.sub(vec3(...eye.center)).normalize()
    const along = toViewer.dot(look)
    const across = toViewer.sub(look.mul(along))
// Stable direction even when the viewer stands exactly on the eye’s axis.
    const direction = across.add(vec3(...eye.lidUp).mul(1e-4)).normalize()
    const angle = atan(across.length(), along)
    const roll = angle.div(gazeLimit).mul(0.9).tanh().mul(gazeLimit)
    const aim = look.mul(roll.cos()).add(direction.mul(roll.sin()))
    return aim.add(vec3(...eye.lidSide).mul(jitter.x)).add(vec3(...eye.lidUp).mul(jitter.y)).normalize()
  })
}
/** Polynomial smooth maximum: a stuffed-felt fillet of width k where two shapes meet. */
const smax = (a: Node<'float'>, b: Node<'float'>, k: number) => {
  const h = float(k).sub(a.sub(b).abs()).max(0)
  return a.max(b).add(h.mul(h).div(4 * k))
}
/** The mesh has only 256 rings, so the head would be faceted. Rings are slid along the knot instead: three times denser over the head, 6% sparser elsewhere. Monotonic, periodic and seam-safe. */
const warpWidth = 0.04
const warpStrength = 0.76
const warpBalance = 2 * warpWidth * Math.tanh(0.5 / warpWidth)
function warpU(u: Node<'float'>) {
  const x = u.sub(headU).add(0.5).fract().sub(0.5)
  return u.add(x.mul(warpBalance).sub(x.div(warpWidth).tanh().mul(warpWidth)).mul(warpStrength))
}
/** The mesh’s own ring frame (as in TorusKnotGeometry: 0.01 radians ahead, crossed with P1 + P2), placed on the shrunken body. */
function ringFrame(u: Node<'float'>) {
  const angle = u.mul(TAU * 2)
  const point = knotCurve(angle)
  const ahead = knotCurve(angle.add(0.01))
  const tangent = ahead.sub(point)
  const binormal = tangent.cross(ahead.add(point)).normalize()
  const normal = binormal.cross(tangent).normalize()
  return {
    point: point.mul(bodyScale).add(vec3(...pivot).mul(1 - bodyScale)),
    tangent: tangent.normalize(),
    binormal,
    normal,
  }
}
/** Knot-space vector → face-frame components (right, up, forward). */
const faceFrame = (vector: Node<'vec3'>) => vec3(vector.dot(vec3(...right)), vector.dot(vec3(...up)), vector.dot(vec3(...forward)))
/** Exit distance of a ray from inside an ellipsoid, plus how deeply the origin sits inside (0 at the shell). */
function ellipsoidExit(origin: Node<'vec3'>, direction: Node<'vec3'>, center: Node<'vec3'>, radii: Node<'vec3'>) {
  const o = faceFrame(origin.sub(center)).div(radii)
  const d = faceFrame(direction).div(radii)
  const a = d.dot(d)
  const b = o.dot(d)
  const c = o.dot(o).sub(1)
  return {
    depth: c.negate(),
    exit: b.negate().add(b.mul(b).sub(a.mul(c)).max(0).sqrt()).div(a),
  }
}
/** Far-side hit of a ray against a sphere; it keeps decreasing smoothly where the ray misses. */
function sphereExit(origin: Node<'vec3'>, direction: Node<'vec3'>, center: Node<'vec3'>, radius: number) {
  const offset = origin.sub(center)
  const b = direction.dot(offset)
  const discriminant = b.mul(b).sub(offset.dot(offset).sub(radius * radius))
  return b.negate().add(discriminant.abs().sqrt().mul(discriminant.sign()))
}
/** Signed distance between two periodic coordinates, in −0.5…0.5. */
const wrapped = (value: Node<'float'>) => value.add(0.5).fract().sub(0.5)
type SurfaceOptions = {
/** Edge softness of the bow, in object units: wide for the coarse mesh, crisp for per-pixel normals. */
  bowSoftness: number
/** Breathing, roughly in −1…1. */
  breathing: Node<'float'>
}
/** Three plump toes on each lower lobe, splayed along the tube at the front-bottom, as a 0…1 height. Gaussian bumps in arc-length units keep them round however fast the parametrization runs. */
function webbedToes(u: Node<'float'>, v: Node<'float'>) {
  let toes: Node<'float'> = float(0)
  for (const foot of feet) {
    const along = wrapped(u.sub(foot.u)).mul(foot.speed)
    const around = wrapped(v.sub(foot.around)).mul(TAU * tubeRadius)
    for (const spread of [-1, 0, 1]) {
      const ds = along.sub(spread * 0.078).div(0.03)
// Outer toes angle outward a little, like a sitting frog’s.
      const da = around.sub(spread * 0.012).div(0.07)
      toes = toes.add(ds.mul(ds).add(da.mul(da)).negate().exp())
    }
  }
  return toes
}
/** The plush figure as a radius field over the tube: the head lobe inflates into an ellipsoidal pillow, two eye spheres bulge through the crown with stuffed fillets and a bow tie is raised under the chin. Every shape is ray-cast from the tube centerline, so the surface stays a single closed sheet. */
function plushSurface(u: Node<'float'>, v: Node<'float'>, {breathing, bowSoftness}: SurfaceOptions) {
  const ring = ringFrame(u)
  const around = v.mul(TAU)
  const direction = ring.normal.mul(around.cos().negate()).add(ring.binormal.mul(around.sin()))
  const swell = breathing.mul(0.012).add(1)
  const radii = vec3(...head.radii).mul(vec3(swell, swell, swell.sub(1).mul(1.6).add(1)))
  const pillow = ellipsoidExit(ring.point, direction, vec3(...head.center), radii)
// Fades the head out as the centerline leaves the pillow, so no other strand ever inflates.
  const inHead = pillow.depth.smoothstep(-1.2, 0.25)
  const body = smax(float(tubeRadius), pillow.exit, 0.05)
  let radius: Node<'float'> = body
  let crease: Node<'float'> = float(0)
  for (const eye of eyes) {
    const eyeBulge = sphereExit(ring.point, direction, vec3(...eye.center).add(vec3(...up).mul(breathing.mul(0.003))), eyeRadius)
    const joined = smax(radius, eyeBulge, eyeFillet)
// How much stuffing the fillet adds: a proxy for the crease where the eye bump meets the head.
    crease = crease.max(joined.sub(radius.max(eyeBulge)).div(eyeFillet / 4))
    radius = joined
  }
  radius = float(tubeRadius).add(radius.sub(tubeRadius).mul(inHead))
  const toes = webbedToes(u, v)
  radius = radius.add(toes.mul(0.03))
  const shell = ring.point.add(direction.mul(radius))
  const relief = bowRelief(shell.sub(vec3(...bow.center)), bowSoftness)
  radius = radius.add(relief.height.mul(inHead))
  return {
    around,
    bowRelief: relief,
    crease: crease.mul(inHead),
    direction,
    inHead,
    point: ring.point.add(direction.mul(radius)),
    radius,
    ring,
    shell,
    toes,
  }
}
/** Thickness of the loose-fiber layer that frays the silhouette. */
const fuzz = 0.0045
/** Ladder stitches along the two seams: a whole number per lap so the seam closes on itself. */
const stitchCount = Math.round(arcLength.total / 0.009)
const arc = (u: Node<'float'>) => {
  let sum: Node<'float'> = u.mul(arcLength.total)
  for (const [index, coefficient] of arcLength.coefficients.entries()) {
    sum = sum.add(u.mul(TAU * 3 * (index + 1)).sin().mul(coefficient))
  }
  return sum
}
/** A felt frog prince: a lime wool-felt plush sewn around the infinity knot, with a pillowy head, felt eyes whose glossy safety pupils follow visitors, a satin bow tie, slow breathing, blinking and a blush that rises when someone leans in close. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.75)
    this.name = knotData.id
    const tube = uv()
    const breathing = breath()
    const blinking = blink()
// Geometry: the knot is re-posed head-up, shrunk to chibi proportions, inflated into the plush and wrapped in fuzz.
    const shape = plushSurface(warpU(tube.x), tube.y, {
      breathing,
      bowSoftness: 0.012,
    })
    this.positionNode = placeInObject(shape.ring.point.add(shape.direction.mul(shape.radius.add(fuzz))))
// Per-pixel shape: the same surface with a crisp bow, differentiated in u and v for a smooth normal.
    const surface = (u: Node<'float'>, v: Node<'float'>) => plushSurface(warpU(u), v, {
      breathing,
      bowSoftness: 0.0025,
    })
    const here = surface(tube.x, tube.y)
    const stepU = 0.00012
    const stepV = 0.00025
    const alongU = surface(tube.x.add(stepU), tube.y).point.sub(surface(tube.x.sub(stepU), tube.y).point)
    const alongV = surface(tube.x, tube.y.add(stepV)).point.sub(surface(tube.x, tube.y.sub(stepV)).point)
    const raw = alongU.cross(alongV).normalize()
    const shapeNormal = raw.dot(here.direction).greaterThan(0).select(raw, raw.negate())
    const point = here.point
    const local = faceFrame(point.sub(vec3(...head.center)))
    const viewer = viewerKnot()
    const toViewer = viewer.sub(point).normalize()
    const facing = shapeNormal.dot(toViewer).clamp()
    const distance = positionView.length()
// The preview frames this figure from about 2.4 units; its close-up stands at 1.2.
    const near = distance.smoothstep(1.4, 4).oneMinus()
    const intimate = distance.smoothstep(1.1, 2).oneMinus()
    const footprint = point.fwidth().length().max(1e-6)
// Wool felt over every soft part.
    const wool = felt(point, footprint)
// Eyes: they follow the visitor, dilate a little as you lean in and blink now and then.
    const eye = eyeLayers({
      point,
      aims: gaze(viewer),
      lidClosure: blinking,
      breathLift: vec3(...up).mul(breathing.mul(0.003)),
      dilation: intimate.mul(maxDilation - 0.94).add(0.94),
    })
    const openEye = eye.lid.oneMinus()
    const glossyPupil = eye.pupil.mul(openEye)
    const bowTie = here.bowRelief
    const bowCover = bowTie.coverage.mul(here.inHead)
    const tag = careLabel(warpU(tube.x), tube.y)
    const felted = bowCover.oneMinus().mul(eye.white.oneMinus().max(eye.lid)).mul(tag.mask.oneMinus())
// Seams: the two felt halves meet along the inner and outer rims of the knot, closed with ladder stitch.
    const seamDistance = here.around.sin().mul(here.radius).abs()
    const seam = seamDistance.smoothstep(0, 0.007).oneMinus().mul(felted)
    const stitchPhase = arc(warpU(tube.x)).mul(stitchCount / arcLength.total)
    const stitchAlong = stitchPhase.fract().sub(0.5).abs().smoothstep(0.18, 0.3).oneMinus()
    const stitches = stitchAlong.mul(seamDistance.smoothstep(0.0035, 0.005).oneMinus()).mul(footprint.smoothstep(0.0012, 0.003).oneMinus()).mul(felted)
// Blush: soft rosy cheeks that warm up as a visitor leans in – he is a little shy.
    let cheek: Node<'float'> = float(0)
    for (const side of [-1, 1]) {
      const dx = local.x.sub(side * cheeks.x).div(cheeks.radii[0])
      const dy = local.y.sub(cheeks.y).div(cheeks.radii[1])
      cheek = cheek.add(dx.mul(dx).add(dy.mul(dy)).negate().exp())
    }
    const blush = cheek.mul(local.z.smoothstep(0, 0.08)).mul(here.inHead).mul(felted).mul(intimate.mul(0.75).add(0.25))
// Color.
    const lime = color('#a8ea00')
    const limeShadow = color('#6cae00')
    const greenFelt = mix(limeShadow, lime, wool.mottle.mul(0.5).add(0.62).clamp()).mul(wool.albedo)
    const whiteFelt = color('#f4f4ec').mul(wool.albedo.sub(1).mul(0.5).add(1))
    let base: Node<'vec3'> = greenFelt
    base = mix(base, lime.mul(1.08).mul(wool.albedo), here.toes.clamp().mul(0.35))
    base = mix(base, color('#ff8f7a').mul(wool.albedo), blush.mul(0.42))
    base = mix(base, whiteFelt, eye.white.mul(openEye))
    base = mix(base, color('#020203'), glossyPupil)
    base = mix(base, greenFelt.mul(0.55), eye.lidEdge.mul(0.7))
    base = mix(base, base.mul(0.62), eye.rim.mul(openEye))
    base = mix(base, base.mul(0.72), seam.mul(0.35).add(stitches.mul(0.4)))
    base = mix(base, color('#09090c'), bowCover)
    base = mix(base, mix(color('#f3efe4'), color('#7d8796'), tag.ink).mul(tag.hem.mul(0.12).oneMinus()), tag.mask)
    this.colorNode = base
// Surface response: felt is matte with a velvet sheen, the pupils are glossy plastic and the bow is satin.
    this.metalness = 0
    this.roughnessNode = mix(mix(mix(float(0.92), float(0.07), glossyPupil), float(0.3).add(bowTie.fold.mul(0.1)), bowCover), float(0.38), tag.mask)
    this.specularIntensityNode = mix(mix(float(0.22), float(0.2), glossyPupil), float(0.8), bowCover)
    this.sheenNode = mix(mix(color('#c6ff2e').mul(0.8), color('#ffffff').mul(0.6), eye.white.mul(openEye)), color('#fffaf0').mul(0.9), tag.mask).mul(glossyPupil.max(bowCover).oneMinus())
    this.sheenRoughnessNode = float(0.42)
    this.clearcoatNode = glossyPupil.mul(0.25).add(bowCover.mul(0.35))
    this.clearcoatRoughnessNode = mix(float(0.03), float(0.16), bowCover)
// Normals: shape, then the pupil domes, then fiber, seam, stitch and lid relief.
    const shapeView = transformNormalToView(toObject(shapeNormal)).normalize()
    const pupilView = transformNormalToView(toObject(eye.pupilNormal)).normalize()
    const domed = mix(shapeView, pupilView, glossyPupil).normalize()
// The white disc is a second layer of felt, so it stands a hair proud of the eye bump.
    const relief = wool.height.mul(felted.max(eye.white.mul(0.6))).add(eye.white.mul(openEye).mul(0.0012)).sub(seam.mul(0.0022)).add(stitches.mul(0.0007)).add(eye.lidHeight).add(tag.height)
    const normal = bump(domed, relief)
    this.normalNode = normal
// Occlusion, so the plush reads as soft volumes under the even studio light.
    let crossing: Node<'float'> = float(0)
    for (const strand of crossingStrands) {
      const anchor = vec3(...strand.point)
      const tangent = vec3(...strand.tangent)
      const closest = anchor.add(tangent.mul(point.sub(anchor).dot(tangent).clamp(-0.25, 0.25)))
      const toward = closest.sub(point)
      const gap = toward.length()
      crossing = crossing.add(float(tubeRadius).div(gap.max(tubeRadius)).pow2().mul(shapeNormal.dot(toward.div(gap.max(1e-4))).clamp()))
    }
// Where the body tucks under the head.
    const headDistance = local.div(vec3(...head.radii)).length()
    const underHead = headDistance.smoothstep(1.7, 1).mul(here.inHead.oneMinus()).mul(shapeNormal.dot(vec3(...head.center).sub(point).normalize()).clamp())
// Downward-facing felt sees less of the bright room.
    const skyward = faceFrame(shapeNormal).y.smoothstep(-1, 0.7).mul(0.45).add(0.55)
    const bowShadow = bowRelief(here.shell.sub(vec3(...bow.center)), 0.05).coverage.mul(bowTie.coverage.oneMinus()).mul(here.inHead)
    this.aoNode = crossing.mul(0.75).oneMinus().mul(here.crease.clamp().mul(0.45).oneMinus()).mul(bowShadow.mul(0.55).oneMinus()).mul(underHead.mul(0.6).oneMinus())
      .mul(seam.mul(0.25).oneMinus()).mul(skyward).clamp(0.15, 1)
// Loose fibers fray the silhouette; glossy parts stay crisp.
    const fringe = fuzzOpacity(point, shapeNormal, facing, here.radius, fuzz)
    this.opacityNode = mix(fringe, float(1), glossyPupil.max(bowCover).max(near.oneMinus().mul(0.5)))
    this.alphaTest = 0.5
    this.alphaToCoverage = true
// Catchlights: a photographer’s softbox over the visitor’s shoulder, so the pupils always sparkle.
    const reflected = positionView.normalize().reflect(normal)
    const sparkle = reflected.dot(vec3(-0.35, 0.55, 0.76).normalize()).smoothstep(0.93, 0.985).add(reflected.dot(vec3(0.5, -0.2, 0.84).normalize()).smoothstep(0.985, 0.997).mul(0.4))
    const satin = reflected.dot(cameraViewMatrix.mul(vec4(0, 1, 0, 0)).xyz).smoothstep(0.3, 1).mul(bowCover).mul(0.03)
    this.emissiveNode = color('#ffffff').mul(sparkle.mul(glossyPupil).mul(1.1)).add(color('#cfd8ff').mul(satin))
      .add(color('#d5ff5a').mul(facing.oneMinus().pow(3).mul(felted).mul(0.06)))
// The alpha-cut fuzz is only an outer layer: the stuffed felt underneath must remain closed.
    const stuffedCoreMaterial = new MeshPhysicalNodeMaterial
    this.coreMaterial = stuffedCoreMaterial.copy(this)
    this.coreMaterial.name = `${knotData.id} core`
    this.coreMaterial.positionNode = placeInObject(shape.point)
    this.coreMaterial.opacityNode = float(1)
    this.coreMaterial.alphaTest = 0
    this.coreMaterial.alphaToCoverage = false
  }
}
