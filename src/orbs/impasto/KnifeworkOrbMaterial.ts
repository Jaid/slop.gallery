import type {ImpastoPaint} from '#src/lib/materials/impastoPaints.ts'
import type {OrbFill, OrbGlassOptions, OrbRay} from '../base/OrbGlassMaterial.ts'
import type {Node} from 'three/webgpu'

import {Break, float, If, Loop, max, mix, mx_cell_noise_float, normalize, select, smoothstep, time, vec3} from 'three/tsl'

import {impastoPaints} from '#src/lib/materials/impastoPaints.ts'

import OrbGlassMaterial from '../base/OrbGlassMaterial.ts'
import {rgb, spinAroundY} from '../lib/fill.ts'
import {orbNoise} from '../lib/noise.ts'

type Float = Node<'float'>
type Vec3 = Node<'vec3'>

/** the most steps the march takes through the oil toward the paint */
const steps = 112
/** how far one step of the march goes at least, in radii of the orb, and how close to the paint it counts as a hit */
const stride = 0.0025
const surfaceReach = 0.0015
/** how far a step goes of the distance to the paint the field reports, which the wavering flats and the crests overstate a little */
const caution = 0.65
/** how close to the paint a ray that ran out of steps still counts as on it, as rays grazing its outline do */
const grazing = 0.005
/** how many flats the knife pressed into the lump of paint, spread evenly round it, each a swathe of its own paint */
const facetCount = 34
/** how far in from the orb’s middle the flats lie, nearest and farthest, in radii of the orb, and how far the knife presses one in and lets it out again as it keeps working the lump */
const flats = {
  near: 0.52,
  far: 0.62,
  press: 0.014,
  pace: 0.32,
  /** how steeply a flat rises along its stroke, so the paint lies thin where the knife set down, sinking under the flat before it, and stands proud where it was driven to */
  tilt: 0.2,
}
/**
 * the bead of paint the knife pushed up at the end of a stroke, just inside the edge it drove the paint toward, where the next flat was laid over it: how far in from the edge it rises highest and how high it stands there, as distances between the flats, and how far its height wavers along it, pulled up into crests where the blade lifted off
 * It falls back to nothing at the edge itself, so the flats meet without a step.
 */
const bead = {
  width: 0.026,
  height: 0.034,
  crests: 0.9,
  crestScale: 3.2,
}
/** how far the knife’s flats bow and waver, so their edges run in broad arcs rather than dead straight: how fine the wavering is and how far it pushes them, in radii of the orb */
const warping = {
  scale: 1.1,
  reach: 0.055,
}
/** where the light falls into the orb from, in its own frame: from above, a little from the front and the left, raking across the knife’s flats */
const light = normalize(vec3(-0.4, 1, 0.5))
/** how far apart the paint is sampled to find which way its surface faces, and how far out over it the shade of the crevices is measured, in radii of the orb */
const normalStep = 0.004
const occlusionReach = 0.05
/** the second paint the knife carried on one side of its blade, folded through some swathes in streaks along the stroke: how many of the swathes carry one, how many streaks lie across a radius, and how far they wander */
const folding = {
  share: 0.55,
  streaks: 9,
  wander: 0.35,
}
/** the paints the lump was kneaded from, each as often as its share: the dusk’s deep blues and teals first, its warm lights and the white they were cut with between them */
const shares: ReadonlyArray<readonly [ImpastoPaint, number]> = [
  ['prussianBlue', 0.26],
  ['cobaltTeal', 0.2],
  ['naplesYellow', 0.17],
  ['cadmiumOrange', 0.15],
  ['titaniumWhite', 0.13],
  ['alizarinCrimson', 0.09],
]
/** the warm light the dusk glows with round the lump’s rim, seen against the light */
const rimGlow = rgb('#ffb066')
/** A pseudo-random number from 0 to 1 for the number, the same on every run. */
const scatter = (seed: number) => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43_758.5453
  return value - Math.floor(value)
}
/** the knife’s flats: which way each faces, as a unit vector from the orb’s middle, how far out it lies, the way the knife was drawn across it and when it presses it in */
const facets = Array.from({length: facetCount}, (_, index) => {
  // Fibonacci sphere: every flat claims as much of the lump round it, a little askew so they don’t line up.
  const y = 1 - 2 * (index + 0.5) / facetCount
  const across = Math.sqrt(1 - y * y)
  const angle = index * Math.PI * (3 - Math.sqrt(5)) + (scatter(index) - 0.5) * 0.4
  const normal = [Math.cos(angle) * across, y, Math.sin(angle) * across] as const
  // Any direction in the flat’s plane, turned by an angle of its own.
  const helper = Math.abs(normal[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  const first = cross(normal, helper)
  const second = cross(normal, first)
  const drawn = scatter(index + 0.37) * Math.PI
  const stroke = first.map((value, axis) => value * Math.cos(drawn) + second[axis] * Math.sin(drawn))
  return {
    normal: vec3(...normal),
    stroke: vec3(stroke[0], stroke[1], stroke[2]),
    height: flats.near + scatter(index + 0.71) * (flats.far - flats.near),
    phase: scatter(index + 0.13) * Math.PI * 2,
  }
})
/** The cross product of two vectors of numbers. */
function cross(a: ReadonlyArray<number>, b: ReadonlyArray<number>) {
  const value = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
  const length = Math.hypot(...value)
  return value.map(component => component / length)
}
/** The paint at `random` 0–1 among the paints by their {@link shares}. */
function sharedPaint(random: Float) {
  let paint: Vec3 = rgb(impastoPaints[shares[0][0]])
  let threshold = 0
  for (const [name, share] of shares) {
    paint = select(random.greaterThanEqual(threshold), rgb(impastoPaints[name]), paint)
    threshold += share
  }
  return paint
}
/** The point in the lump’s own frame, which turns slowly round the orb’s upright and rocks to and fro a little, as if it hung in the oil. */
function inLump(point: Vec3) {
  const spun = spinAroundY(point, time.mul(0.16))
  const rock = time.mul(0.21).sin().mul(0.22)
  const [cosine, sine] = [rock.cos(), rock.sin()]
  return vec3(spun.x, spun.y.mul(cosine).sub(spun.z.mul(sine)), spun.y.mul(sine).add(spun.z.mul(cosine)))
}
/**
 * Where a point of the orb lies from the lump of paint, as a distance that never overstates it by much, negative inside, and, if `detailed`, which of the knife’s flats it lies on, by its number, the way the knife was drawn across it, how far up the bead along its edge it lies and the point in the lump’s own frame.
 * The lump is the paint the knife pressed into flats all round, their edges wavering, each lying at its own depth, which the knife keeps pressing in and letting out a little, lumpy all over. Every flat’s paint was driven toward the edges the stroke ran into, where it heaped into a bead, pulled up into crests here and there, as if the next flat had been laid over it.
 */
function lumpAt(point: Vec3, detailed = false) {
  const q = inLump(point).toVar()
  const warped = q.add(orbNoise(q.mul(warping.scale).add(2.3)).xyz.mul(warping.reach)).toVar()
  const flatOf = (facet: typeof facets[number]) => warped.dot(facet.normal).add(warped.dot(facet.stroke).mul(flats.tilt)).sub(time.mul(flats.pace).add(facet.phase).sin().mul(flats.press).add(facet.height))
  // The flat the point lies on is the one reaching farthest out.
  const best = float(-9).toVar()
  const stroke = vec3(1, 0, 0).toVar()
  const bestNormal = vec3(0, 1, 0).toVar()
  const number = detailed ? float(0).toVar() : undefined
  for (const [index, facet] of facets.entries()) {
    const flat = flatOf(facet)
    const nearest = flat.greaterThan(best)
    bestNormal.assign(select(nearest, facet.normal, bestNormal))
    stroke.assign(select(nearest, facet.stroke, stroke))
    if (number) {
      number.assign(select(nearest, float(index), number))
    }
    best.assign(max(best, flat))
  }
  // The bead along every edge the stroke ran into, rising from nothing at the edge to its height a little inside and falling off further in.
  const beads = float(0).toVar()
  for (const facet of facets) {
    const apart = best.sub(flatOf(facet)).div(bead.width)
    const toEdge = facet.normal.sub(bestNormal.mul(facet.normal.dot(bestNormal)))
    const into = stroke.dot(toEdge).div(toEdge.length().max(1e-4)).smoothstep(0.4, 0.85)
    beads.assign(max(beads, apart.mul(apart.oneMinus().mul(1.6).exp()).mul(into)))
  }
  const crests = orbNoise(q.mul(bead.crestScale).add(6.1)).y.mul(bead.crests).add(1).max(0.2)
  const lumps = orbNoise(q.mul(1.9).add(4.1)).x.mul(0.022)
  return {
    distance: best.sub(beads.mul(crests).mul(bead.height)).add(lumps),
    number,
    point: q,
    ridge: beads.clamp(0, 1),
    stroke,
  }
}

/** A lump of heavy-bodied paint hanging in clear oil, sculpted with a palette knife: pressed into flats all round, each a swathe of a paint of its own, some streaked with a second one, its paint heaped into a bead along the edges the stroke ran into and pulled up into crests here and there, scored by the knife’s edge, glossy and lit from above with a warm glow round its rim. It turns slowly as the oil carries it, and an unseen knife keeps working it, pressing its flats in and letting them out. */
export default class KnifeworkOrbMaterial extends OrbGlassMaterial {
  constructor(options: OrbGlassOptions) {
    super(options, {
      name: 'orb-knifework',
      fillIor: 1.48,
      // Linseed oil, amber, which outlines the ball against whatever lies behind it.
      tint: '#e0b36a',
    })
  }

  /** The paint is opaque, so the ray ends on the lump’s surface and is shaded by which way it faces there, how deep in its crevices it lies and which paint the knife cut into. */
  protected override fill(ray: OrbRay): OrbFill {
    const hit = float(0).toVar('knifeworkHit')
    const depth = ray.jitter.mul(stride).toVar('knifeworkDepth')
    const closest = float(9).toVar('knifeworkClosest')
    Loop({
      start: 0,
      end: steps,
      type: 'int',
    }, () => {
      If(depth.greaterThan(ray.length), () => {
        Break()
      })
      const {distance} = lumpAt(ray.origin.add(ray.direction.mul(depth)))
      If(distance.lessThan(surfaceReach), () => {
        hit.assign(1)
        Break()
      })
      depth.addAssign(distance.mul(caution).max(stride))
      closest.assign(closest.min(distance))
    })
    // A ray grazing the outline may run out of steps right at the paint’s surface; it counts as on it.
    If(hit.lessThan(0.5).and(closest.lessThan(grazing)).and(depth.lessThan(ray.length)), () => {
      hit.assign(1)
    })
    const point = ray.origin.add(ray.direction.mul(depth)).toVar('knifeworkPoint')
    const {distance, number, point: local, ridge, stroke} = lumpAt(point, true)
    const knife = stroke.toVar('knifeworkStroke')
    const swathe = number!.toVar('knifeworkSwathe')
    const gradient = vec3(
      lumpAt(point.add(vec3(normalStep, 0, 0))).distance.sub(distance),
      lumpAt(point.add(vec3(0, normalStep, 0))).distance.sub(distance),
      lumpAt(point.add(vec3(0, 0, normalStep))).distance.sub(distance),
    ).normalize()
    // The knife’s edge scored fine lines into every flat along the way it was drawn, which the ridges, pushed up out of the flats, have none of.
    const lengthwise = local.dot(knife)
    const across = local.sub(knife.mul(lengthwise))
    const scored = orbNoise(across.mul(60).add(knife.mul(lengthwise.mul(1.5)))).xyz.mul(0.2).add(orbNoise(across.mul(22).add(knife.mul(lengthwise.mul(0.8))).add(5.1)).xyz.mul(0.16)).mul(ridge.oneMinus())
    const grain = orbNoise(local.mul(26).add(9.7)).xyz.mul(0.035)
    const normal = gradient.add(scored).add(grain).normalize().toVar('knifeworkNormal')
    // Every flat is a swathe the knife laid in a paint of its own; on some, a second paint it carried on one side of the blade streaks along the stroke without mixing in, and the paint’s tone wavers along it.
    const crosswise = across
    const wander = orbNoise(crosswise.mul(2.2).add(knife.mul(lengthwise.mul(0.6))).add(swathe.mul(1.3))).x.mul(folding.wander)
    const streaks = orbNoise(crosswise.mul(folding.streaks).add(knife.mul(lengthwise.mul(0.35))).add(swathe.mul(2.9)).add(wander)).y
    const carries = mx_cell_noise_float(vec3(swathe, 3.5, 0)).lessThan(folding.share)
    const folded = streaks.smoothstep(0.05, 0.25).mul(select(carries, float(1), float(0.22)))
    const paint = mix(sharedPaint(mx_cell_noise_float(vec3(swathe, 0.5, 0))), sharedPaint(mx_cell_noise_float(vec3(swathe, 1.5, 0))), folded)
    const tone = orbNoise(crosswise.mul(6).add(knife.mul(lengthwise.mul(1.5))).add(swathe)).z.mul(0.18).add(1)
    // Little light reaches down into the crevices at the foot of the beads.
    const open = lumpAt(point.add(normal.mul(occlusionReach))).distance.div(occlusionReach).clamp(0, 1).mul(0.6).add(0.4)
    const view = ray.direction.negate()
    const lit = normal.dot(light).max(0).mul(0.85).add(0.18).mul(open)
    // Fresh paint glints wet where the knife planed it and sheens broadly over its flats.
    const halfway = light.add(view).normalize()
    const facing = normal.dot(halfway).max(0)
    // The beads, freshly pushed up, are wetter than the planed flats.
    const gloss = facing.pow(70).mul(0.7).add(facing.pow(12).mul(0.06)).mul(open).mul(ridge.mul(0.9).add(1))
    // The dusk glows warm round its rim, where the paint turns away from the viewer, strongest on its shaded side.
    const rim = float(1).sub(normal.dot(view).abs()).pow(3).mul(smoothstep(0.6, -0.4, normal.dot(light)).mul(0.25).add(0.15))
    // The oil in front of the paint dims it the deeper it lies.
    const depthShade = depth.mul(-0.3).exp()
    return {
      radiance: paint.mul(tone).mul(lit).add(rimGlow.mul(rim).mul(open)).mul(depthShade).add(vec3(gloss)).mul(hit),
      transmittance: hit.oneMinus(),
    }
  }
}
