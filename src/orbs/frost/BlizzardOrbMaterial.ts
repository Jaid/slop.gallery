import type {FillLayer, OrbGlassOptions, OrbRay} from '../base/OrbGlassMaterial.ts'
import type {Node} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, cross, float, fwidth, mix, modelWorldMatrixInverse, mx_cell_noise_vec3, select, smoothstep, time, vec2, vec3, vec4} from 'three/tsl'

import {frostColors} from '#src/lib/materials/frostColors.ts'
import {snowflakeShape, stellarDendrite} from '#src/lib/materials/snowflake.ts'

import OrbGlassMaterial from '../base/OrbGlassMaterial.ts'
import {coverage, ellipsoidHit, planeDepth, rgb, spinAroundY, turn} from '../lib/fill.ts'
import {orbFractalNoise, orbNoise} from '../lib/noise.ts'

const steps = 30
/** how far the crystal in the middle reaches to the tips of its arms, in radii of the orb */
const crystalRadius = 0.4
/**
 * The cylinders round the globe’s axis the snowflakes whirl on, from the eye of the storm outward: their radius, how many flakes fit above one another per radius of the orb, how fast they turn, in radians a second, how fast their flakes sink, in radii a second, how big the flakes are, as a share of the space each has, and how many times as long as wide the wind smears them, the outer ones, blown fastest, into streaks.
 * Every flake has a place of its own on its shell, as long along the wind as it is smeared, so no flake reaches past it.
 */
const shells = [
  {
    radius: 0.22,
    rows: 13,
    spin: 0.9,
    fall: 0.09,
    size: 0.11,
    streak: 1,
  },
  {
    radius: 0.34,
    rows: 14,
    spin: 0.75,
    fall: 0.08,
    size: 0.11,
    streak: 1.3,
  },
  {
    radius: 0.46,
    rows: 15,
    spin: 0.68,
    fall: 0.1,
    size: 0.1,
    streak: 1.8,
  },
  {
    radius: 0.58,
    rows: 17,
    spin: 0.85,
    fall: 0.07,
    size: 0.085,
    streak: 2.6,
  },
  {
    radius: 0.7,
    rows: 19,
    spin: 0.78,
    fall: 0.06,
    size: 0.08,
    streak: 3.2,
  },
  {
    radius: 0.82,
    rows: 21,
    spin: 0.7,
    fall: 0.05,
    size: 0.075,
    streak: 3.8,
  },
].map(shell => ({
  ...shell,
  /** how many places for flakes there are round the shell, each {@link streak} times as long as it is high */
  around: Math.max(6, Math.round(Math.PI * 2 * shell.radius * shell.rows / shell.streak)),
}))
/** the share of the places on a shell that hold a flake */
const flakeShare = 0.46
/** the hoarfrost’s needles growing in from the rim of the glass as whoever looks in sees it: how many of them there are round it, how far in they reach at most, in radii of the orb, how thick they are, how far apart their side branches grow, and at which angle from the needle, how long those grow at most */
const needles = {
  count: 120,
  reach: 0.17,
  width: 0.004,
  spacing: 0.012,
  angle: Math.PI / 3,
  branch: 0.022,
}
/** the ice cap frozen to the bottom of the glass, in the orb’s own frame, a flattened ellipsoid sunk into the glass: the height of its middle, and its radii across and up, its top heaped up highest in the middle of the globe and meeting the glass a little lower all round */
const drift = {
  center: -1.12,
  radii: [1.35, 0.56, 1.35] as [number, number, number],
  /** how far its outline heaves up and down in drifts, as a share of its radii */
  lumps: 0.05,
}
const driftAxes: [Node<'vec3'>, Node<'vec3'>, Node<'vec3'>] = [vec3(1, 0, 0), vec3(0, 1, 0), vec3(0, 0, 1)]
/** Where the ray meets the snowdrift and how much of the pixel it covers, like `ellipsoidHit`, its outline heaving in drifts where the ray passes closest to the mound. */
function lumpyMound(origin: Node<'vec3'>, direction: Node<'vec3'>) {
  const center = vec3(0, drift.center, 0)
  const hit = ellipsoidHit(origin, direction, center, driftAxes, drift.radii)
  // Where the ray passes closest to the mound’s middle, which its outline is drawn round.
  const closest = origin.add(direction.mul(center.sub(origin).dot(direction)))
  const heave = orbNoise(vec3(closest.x.mul(3.2), closest.z.mul(3.2), 4.4)).x.mul(drift.lumps)
  const offset = origin.sub(center).div(vec3(...drift.radii))
  const scaled = direction.div(vec3(...drift.radii))
  const nearest = offset.sub(scaled.mul(offset.dot(scaled).div(scaled.dot(scaled)))).lengthSq()
  return {
    coverage: coverage(float(1).add(heave).sub(nearest)),
    depth: hit.depth,
  }
}
const snowColor = rgb(frostColors.snow)
const iceColor = rgb(frostColors.ice)
const glowColor = rgb(frostColors.glow)
const nightColor = rgb(frostColors.night)
const duskColor = rgb(frostColors.dusk)
const glintColor = rgb(frostColors.glint)
const auroraColor = rgb(frostColors.aurora)
const fringeColor = rgb(frostColors.auroraFringe)
/** the blue that snow takes in its own shade */
const shadeColor = rgb(hsl.integer(255, 60, 52))
/** how many times the streaks of blowing snow repeat round the globe’s axis, per radian */
const turnScale = 8 / (Math.PI * 2)
/** where the light that the crystal’s facets mirror comes from, in the world: high above, a little in front */
const skyLight = vec3(-0.3, 0.85, 0.42).normalize()
/** how far apart neighboring pixels’ points lie, which antialiases what is drawn there */
function footprint(point: Node<'vec3'>) {
  return fwidth(point).length().max(1e-5)
}
/** The orb’s up, which is the world’s, so its falling snow always sinks toward the floor like in a snow globe, whichever way it lies: a frame of three axes in the orb’s own frame and the point or direction in it. */
function globeFrame() {
  // Use the world's horizontal axes too: projecting a local axis onto the ground would snap as the ball rolled past vertical.
  const side = modelWorldMatrixInverse.mul(vec4(1, 0, 0, 0)).xyz.normalize()
  const up = modelWorldMatrixInverse.mul(vec4(0, 1, 0, 0)).xyz.normalize()
  const ahead = modelWorldMatrixInverse.mul(vec4(0, 0, 1, 0)).xyz.normalize()
  return (vector: Node<'vec3'>) => vec3(vector.dot(side), vector.dot(up), vector.dot(ahead))
}
/** The inverse of {@link globeFrame}: a point or direction in the globe’s frame in the orb’s own frame. */
function globeFrameInverse() {
  const side = modelWorldMatrixInverse.mul(vec4(1, 0, 0, 0)).xyz.normalize()
  const up = modelWorldMatrixInverse.mul(vec4(0, 1, 0, 0)).xyz.normalize()
  const ahead = modelWorldMatrixInverse.mul(vec4(0, 0, 1, 0)).xyz.normalize()
  return (vector: Node<'vec3'>) => side.mul(vector.x).add(up.mul(vector.y)).add(ahead.mul(vector.z))
}
/** The world’s direction in the orb’s own frame, which the crystal set in its glass turns with. */
function toLocal(vector: Node<'vec3'>) {
  return modelWorldMatrixInverse.mul(vec4(vector, 0)).xyz.normalize()
}

/**
 * A snow globe in a blizzard: a great six-armed snow crystal of glowing ice is set in the glass, rolling and tumbling with it, snowflakes whirl round it in a vortex, sinking as they go, through wind-driven streaks of blowing snow under a faint aurora, over a glittering ice cap frozen to the bottom of the glass, which tumbles with it too; hoarfrost creeps in over the glass from its rim. Whichever way the orb lies, its falling snow and aurora keep to the world’s up.
 */
export default class BlizzardOrbMaterial extends OrbGlassMaterial {
  constructor(options: OrbGlassOptions) {
    super(options, {
      name: 'orb-blizzard',
      fillIor: 1.31,
      tint: hsl.integer(232, 60, 88),
    })
  }

  protected override fill(ray: OrbRay) {
    const toGlobe = globeFrame()
    const fromGlobe = globeFrameInverse()
    const origin = toGlobe(ray.origin).toVar('frostOrigin')
    const direction = toGlobe(ray.direction).toVar('frostDirection')
    const eye = toGlobe(ray.eye).toVar('frostEye')
    const {length} = ray
    const globe: OrbRay = {
      ...ray,
      origin,
      direction,
      eye,
    }
    const layers: Array<FillLayer> = []
    // Hoarfrost on the inside of the glass, seen where it curves away from whoever looks in, as frost on a pane is seen best edgewise: needles of ice grow in from the rim, each feathered with branches angled in toward its tip like a fern, longer toward the bottom, over a frosted haze that glitters here and there.
    // It is laid out round the rim as the viewer sees it, from the globe’s up, so a needle always points in toward the middle instead of lying squashed along the rim.
    const view = eye.normalize().toVar('frostView')
    const rimSide = cross(vec3(0, 1, 0), view).add(vec3(1e-4, 0, 0)).normalize()
    const rimUp = cross(view, rimSide)
    const across = origin.sub(view.mul(origin.dot(view)))
    const rimAngle = atan(across.dot(rimUp), across.dot(rimSide)).div(Math.PI * 2).add(0.5).mul(needles.count).toVar('frostRimAngle')
    const inward = float(1).sub(across.length()).toVar('frostInward')
    const needle = rimAngle.floor().mod(needles.count)
    const grown = mx_cell_noise_vec3(vec3(needle, 2.7, 0.3))
    // longer toward the bottom of the globe, where the cold settles
    const lower = smoothstep(0.4, -0.8, origin.y).mul(0.25).add(0.75)
    const needleLength = grown.x.pow(1.3).mul(needles.reach).mul(lower).add(0.015)
    const gap = Math.PI * 2 / needles.count
    // Each needle wanders a little as it grows and leans to one side.
    const lean = grown.z.sub(0.5).mul(0.25)
    const sideways = rimAngle.fract().sub(grown.y.mul(0.5).add(0.25)).mul(gap).add(inward.mul(lean)).add(inward.mul(31).add(grown.z.mul(9)).sin().mul(0.003)).toVar('frostSideways')
    const tipward = float(1).sub(inward.div(needleLength)).clamp()
    const spine = smoothstep(needles.width, needles.width * 0.3, sideways.abs().add(float(needles.width).mul(tipward.oneMinus()))).mul(select(inward.lessThan(needleLength), float(1), float(0)))
    // A branch through the point springs from the needle where it lies this far back toward the rim, by the branches’ angle, each branch as long as it happened to grow, some not at all.
    const spacing = float(needles.spacing).mul(grown.y.mul(0.5).add(0.75))
    const sprung = inward.sub(sideways.abs().div(Math.tan(needles.angle)))
    const branchIndex = sprung.div(spacing).add(0.5).floor()
    const between = sprung.div(spacing).add(0.5).fract().sub(0.5).abs().mul(spacing).mul(Math.sin(needles.angle))
    const branchGrowth = mx_cell_noise_vec3(vec3(needle, branchIndex, select(sideways.greaterThan(0), float(1), float(-1)).add(5.5)))
    const branchLength = tipward.mul(needles.branch).mul(branchGrowth.x.mul(1.2).add(0.1)).min(gap * 0.48)
    const branch = smoothstep(needles.width * 0.6, needles.width * 0.15, between).mul(select(sideways.abs().lessThan(branchLength).and(sprung.greaterThan(0)).and(sprung.lessThan(needleLength)).and(branchGrowth.y.greaterThan(0.2)), float(1), float(0)))
    // A fuzz of tiny crystals right at the rim, between the needles.
    const fuzzAngle = rimAngle.mul(2.7)
    const fuzzCell = mx_cell_noise_vec3(vec3(fuzzAngle.floor(), 8.8, 0))
    const fuzz = smoothstep(needles.width * 0.8, needles.width * 0.2, fuzzAngle.fract().sub(0.5).mul(gap / 2.7).abs()).mul(select(inward.lessThan(fuzzCell.x.mul(0.035).add(0.008)), float(1), float(0)))
    const fern = spine.max(branch.mul(branchGrowth.z.mul(0.5).add(0.4))).max(fuzz.mul(0.55))
    const haze = smoothstep(0.09, 0, inward).mul(lower).mul(0.5).mul(orbNoise(origin.mul(9)).z.mul(0.3).add(0.8))
    const frostCell = mx_cell_noise_vec3(origin.mul(120).floor())
    const frostGlint = smoothstep(0.32, 0.05, origin.mul(120).fract().sub(frostCell.mul(0.5).add(0.25)).length()).mul(frostCell.x.greaterThan(0.8).select(float(1), float(0))).mul(time.mul(frostCell.y.mul(3).add(1)).add(frostCell.z.mul(40)).sin().max(0).pow(8)).mul(smoothstep(0.22, 0.02, inward))
    layers.push({
      depth: float(0.002),
      coverage: fern.mul(0.9).max(haze),
      color: mix(iceColor.mul(0.7), snowColor, fern.mul(0.6).add(0.4)).mul(0.85).add(glintColor.mul(frostGlint.mul(3))),
    })
    // The great crystal is set in the glass, in the orb’s own frame, so it rolls and tumbles with the ball. It only turns slowly in its own plane and rocks a little on its mount.
    const crystalCenter = vec3(0, time.mul(0.6).sin().mul(0.025).add(0.04), 0)
    const rock = time.mul(0.21)
    const normal = vec3(rock.sin().mul(0.18), time.mul(0.13).sin().mul(0.12), 1).normalize().toVar('frostCrystalNormal')
    const crystalUp = vec3(0, 1, 0).sub(normal.mul(normal.y)).normalize()
    const crystalRight = cross(normal, crystalUp)
    const crystalDepth = planeDepth(ray.origin, ray.direction, crystalCenter, normal).toVar('frostCrystalDepth')
    const onPlane = ray.origin.add(ray.direction.mul(crystalDepth)).sub(crystalCenter)
    // Where the crystal is in the globe’s frame, which lights the loose snow round it.
    const crystalLight = toGlobe(crystalCenter).toVar('frostCrystalLight')
    const crystalPoint = turn(vec2(onPlane.dot(crystalRight), onPlane.dot(crystalUp)).div(crystalRadius), time.mul(-0.12)).toVar('frostCrystalPoint')
    const crystal = snowflakeShape(crystalPoint, stellarDendrite)
    const ahead = select(crystalDepth.greaterThan(0).and(crystalDepth.lessThan(length)), float(1), float(0))
    const crystalCoverage = coverage(crystal.inside).mul(ahead).toVar('frostCrystalCoverage')
    // A gleam runs out along every arm in turn, each arm at its own moment, as if the crystal turned in the light.
    const arm = atan(crystalPoint.y, crystalPoint.x).div(Math.PI / 3).add(0.5).floor()
    const gleamAt = time.mul(0.45).add(arm.mul(0.37)).fract().mul(1.6).sub(0.2)
    const flash = smoothstep(0.09, 0, crystal.out.sub(gleamAt).abs()).mul(crystal.ridge.mul(0.7).add(0.3))
    const centerGlow = smoothstep(0.9, 0, crystalPoint.length())
    const rim = smoothstep(0.035, 0, crystal.inside)
    // Every arm is beveled into two facets along its spine, each tilted away from it, which mirror a light high above the globe: as the crystal turns and rocks, the facets flash one after another, while the side toward the light stays brighter, so the crystal reads as cut ice rather than a cutout.
    const armAngle = atan(crystalPoint.y, crystalPoint.x)
    const armSide = armAngle.div(Math.PI / 3).add(0.5).fract().sub(0.5)
    const facing = arm.mul(Math.PI / 3).add(select(armSide.greaterThan(0), float(Math.PI / 2), float(-Math.PI / 2))).add(time.mul(0.12))
    const tilt = crystalRight.mul(facing.cos()).add(crystalUp.mul(facing.sin()))
    const facet = normal.add(tilt.mul(0.55)).normalize()
    const mirrored = ray.direction.sub(facet.mul(ray.direction.dot(facet).mul(2)))
    const sheen = mirrored.dot(toLocal(skyLight)).max(0).pow(14).mul(crystal.ridge.oneMinus().mul(0.7).add(0.3))
    const bevel = select(armSide.greaterThan(0), float(1.15), float(0.85)).mul(crystal.ridge.oneMinus()).add(crystal.ridge.mul(1.25))
    const crystalShade = mix(iceColor, snowColor, crystal.ridge.mul(0.7).add(rim.mul(0.6)).add(centerGlow.mul(0.3)).clamp()).mul(centerGlow.mul(1.3).add(1.4)).mul(bevel).add(glintColor.mul(flash.mul(2.5).add(sheen.mul(3))))
    const halo = crystal.inside.negate().max(0).mul(-9).exp().mul(crystalCoverage.oneMinus()).mul(ahead)
    // Clear ice lets more of the storm through in the middle of its arms than at its edges and ridges.
    layers.push({
      depth: crystalDepth,
      coverage: crystalCoverage.mul(rim.max(crystal.ridge).mul(0.3).add(0.62)),
      color: crystalShade,
      glow: glowColor.mul(halo.mul(0.55)),
    })
    // The whirling flakes, each on its shell round the globe’s axis, met once where the ray enters it and once where it leaves.
    for (const [index, {around, fall, radius, rows, size, spin, streak}] of shells.entries()) {
      const a = direction.x.mul(direction.x).add(direction.z.mul(direction.z)).max(1e-5)
      const b = origin.x.mul(direction.x).add(origin.z.mul(direction.z))
      const c = origin.x.mul(origin.x).add(origin.z.mul(origin.z)).sub(radius * radius)
      const disc = b.mul(b).sub(a.mul(c))
      const root = disc.max(0).sqrt()
      const cell = 1 / rows
      const cellAlong = Math.PI * 2 * radius / around
      for (const side of [-1, 1]) {
        const depth = b.negate().add(root.mul(side)).div(a).toVar()
        const met = select(disc.greaterThan(0).and(depth.greaterThan(0)).and(depth.lessThan(length)), float(1), float(0))
        const point = origin.add(direction.mul(depth))
        const u = atan(point.z, point.x).add(time.mul(spin)).mul(around / (Math.PI * 2))
        const v = point.y.add(time.mul(fall)).div(cell)
        const grid = vec2(u, v).floor()
        const wrapped = vec2(grid.x.sub(grid.x.div(around).floor().mul(around)), grid.y)
        const seed = mx_cell_noise_vec3(vec3(wrapped, index * 7.31))
        const flutter = vec2(time.mul(seed.x.mul(1.4).add(1.1)).add(seed.z.mul(30)).sin(), time.mul(seed.y.mul(1.2).add(0.9)).add(seed.x.mul(30)).cos()).mul(0.05)
        const center = seed.xy.mul(0.4).add(0.3).add(flutter)
        const offset = vec2(u, v).fract().sub(center).mul(vec2(cellAlong, cell))
        // Mostly small, a few large.
        const share = seed.z.div(flakeShare)
        const reach = float(size * cell).mul(share.pow(2).mul(1.3).add(0.35))
        // Where the ray grazes the shell, its flakes crowd together into a line, so they fade out there.
        const incidence = root.div(a.sqrt().mul(radius))
        const present = select(share.lessThan(1), float(1), float(0)).mul(met).mul(smoothstep(0.3, 0.7, incidence)).mul(side < 0 ? 1 : 0.7)
        const pixel = footprint(point)
        // Every flake is a little six-armed star, tumbling at its own pace: its arms reach out to the full size, between them it is half as big.
        const apart = offset.length().max(1e-6)
        const [cosine, sine] = [offset.x.div(apart), offset.y.div(apart)]
        const triple = vec2(cosine.mul(cosine).mul(cosine).mul(4).sub(cosine.mul(3)), sine.mul(3).sub(sine.mul(sine).mul(sine).mul(4)))
        const tumble = time.mul(seed.y.sub(0.5).mul(3)).add(seed.x.mul(20)).mul(3)
        const arms = triple.x.mul(tumble.cos()).sub(triple.y.mul(tumble.sin())).abs().pow(6)
        const core = reach.mul(arms.mul(0.55).add(0.45)).sub(apart).div(pixel.max(reach.mul(0.18))).add(0.5).clamp()
        // Where the wind blows hard, a faint streak of blown snow smears out along its way, as a long exposure would catch it.
        const trailing = vec2(offset.x.div(streak * 1.2), offset.y).length()
        const trail = streak > 1.5 ? reach.mul(0.6).sub(trailing).div(pixel.max(reach.mul(0.7))).add(0.5).clamp().mul(0.26) : float(0)
        const flake = core.max(trail).mul(present)
        // The flakes are lit by the crystal, those near it the brightest, and now and then one flashes as it turns.
        const lit = float(0.08).div(point.sub(crystalLight).lengthSq().add(0.08)).add(0.8)
        const twinkle = time.mul(seed.y.mul(3).add(2)).add(seed.x.mul(50)).sin().max(0).pow(40).mul(0.8)
        const glow = apart.div(reach).negate().mul(1.6).exp().mul(present).mul(flake.oneMinus()).mul(0.2)
        layers.push({
          depth,
          coverage: flake.mul(0.9),
          color: mix(snowColor, glintColor, twinkle.min(1)).mul(lit.add(twinkle)),
          glow: glowColor.mul(glow.mul(lit)),
        })
      }
    }
    // The ice cap the snow froze into: a mound heaped up in the middle of the bottom of the glass and sloping down to it, its surface rippled by the wind, met in closed form. Frozen to the glass, it rolls and tumbles with the ball like the crystal.
    const mound = lumpyMound(ray.origin, ray.direction)
    const inMound = ray.origin.sub(vec3(0, drift.center, 0)).div(vec3(...drift.radii)).length().lessThan(1)
    const driftDepth = select(inMound, float(0.001), mound.depth).toVar('frostDriftDepth')
    const inDrift = select(inMound, float(1), mound.coverage.mul(select(mound.depth.greaterThan(0).and(mound.depth.lessThan(length)), float(1), float(0)))).toVar('frostInDrift')
    const surface = ray.origin.add(ray.direction.mul(driftDepth)).toVar('frostDriftPoint')
    const dunes = orbNoise(vec3(surface.x.mul(3), surface.y.mul(2), surface.z.mul(4)).add(1.7))
    const ripples = orbNoise(vec3(surface.x.mul(14), 5.1, surface.z.mul(9).add(surface.x.mul(3)))).y
    // Sastrugi: ridges the wind carved across the drift, which catch the light in bands.
    const sastrugi = float(1).sub(orbNoise(vec3(surface.x.mul(7), surface.z.mul(18), 6.6)).z.abs().mul(2)).clamp().pow(3).sub(0.3).mul(0.4)
    const driftNormal = surface.sub(vec3(0, drift.center, 0)).div(vec3(...drift.radii.map(radius => radius * radius))).normalize().add(vec3(dunes.x, 0, dunes.z).mul(0.7)).add(vec3(ripples, 0, ripples.mul(0.5)).mul(0.2)).add(vec3(sastrugi, 0, sastrugi.mul(0.35))).normalize()
    const toCrystal = crystalCenter.sub(surface)
    // Lit by the crystal and by the glow of the storm from above, wherever that is now, bluer in the hollows between its drifts.
    const sunlit = driftNormal.dot(toCrystal.normalize()).max(0).mul(float(0.3).div(toCrystal.lengthSq().add(0.15))).add(driftNormal.dot(toLocal(vec3(0, 1, 0))).max(0).pow(4).mul(0.22))
    const crust = orbFractalNoise(surface.mul(14).add(2.2), 3, 2.2).mul(0.5).add(0.5)
    // Glitter: the odd crystal in the snow catching the light, round, flashing as the storm and the viewer move.
    const grains = surface.mul(80)
    const grain = mx_cell_noise_vec3(grains.floor())
    const glitter = smoothstep(0.26, 0.02, grains.fract().sub(grain.mul(0.5).add(0.25)).length()).mul(grain.x.greaterThan(0.7).select(float(1), float(0))).mul(time.mul(grain.y.mul(4).add(1)).add(grain.z.mul(60)).add(ray.eye.x.add(ray.eye.z).mul(6)).sin().mul(0.5).add(0.5).pow(4))
    layers.push({
      depth: driftDepth,
      coverage: inDrift,
      color: mix(shadeColor.mul(0.5), snowColor, sunlit.mul(crust.mul(0.6).add(0.7)).clamp()).mul(sunlit.mul(1.2).add(0.55)).mul(crust.mul(0.3).add(0.82)).add(glowColor.mul(driftNormal.dot(toCrystal.normalize()).max(0).pow(8).mul(0.35))).add(glintColor.mul(glitter.mul(4))),
    })
    const fill = this.march(globe, steps, point => {
      // Streaks of blowing snow, whirling round the axis, the faster the nearer it, in a helix rising up the globe, under curtains of aurora at its top.
      const fromAxis = point.xz.length()
      const swirl = atan(point.z, point.x).add(time.mul(float(0.3).div(fromAxis.add(0.25)))).add(point.y.mul(1.3)).mul(turnScale)
      const wind = vec3(fromAxis.mul(7), point.y.mul(5).add(time.mul(0.25)), swirl)
      // Gusts turning with the storm, in the globe’s own axes, so nothing pinches together at the eye.
      const gust = orbFractalNoise(spinAroundY(point, time.mul(0.35)).mul(vec3(3, 4, 3)).add(vec3(0, time.mul(0.2), 0)), 3, 2, 0.55)
      // Streaks of snow driven round the eye of the storm, which crowd together toward its axis, where they give way to the gusts alone.
      const streaks = float(1).sub(orbNoise(wind.mul(vec3(2.2, 2.6, 1)).add(5.5)).z.abs().mul(2.4)).clamp().pow(3).mul(smoothstep(0.08, 0.3, fromAxis)).mul(smoothstep(0.7, 0.25, point.y))
      const settled = smoothstep(0.6, -0.4, point.y).mul(0.4).add(0.45)
      const wall = smoothstep(1, 0.88, point.length())
      // Snow blowing low over the ice cap, wherever the ball turned it, a bright haze that softens where it meets the storm.
      const groundMist = smoothstep(-0.48, -0.72, fromGlobe(point).y).mul(gust.mul(0.5).add(0.7))
      const density = gust.smoothstep(0.05, 0.6).mul(0.8).add(streaks.mul(1.1)).mul(settled).add(groundMist.mul(1.2)).mul(wall).mul(1.5)
      const light = float(0.05).div(point.sub(crystalLight).lengthSq().add(0.05))
      const lit = mix(shadeColor.mul(0.6), glowColor, light.smoothstep(0.05, 1)).mul(light.mul(1.3).add(0.32))
      // The aurora’s curtains hang straight down like sheets folded across the sky, rayed along their folds.
      const sky = point.xz.mul(2).add(vec2(time.mul(0.03), time.mul(-0.02)))
      const fold = orbNoise(vec3(sky.mul(0.6), 9.1)).y.mul(0.5)
      const curtain = float(1).sub(orbNoise(vec3(sky, fold.add(time.mul(0.03)).add(3.7))).w.abs().mul(6)).clamp().pow(3)
      const rays = orbNoise(vec3(sky.mul(7), point.y.mul(0.5).add(time.mul(0.08)))).x.mul(0.5).add(0.5).pow(2)
      // Each curtain is brightest along its lower hem, fading upward into violet.
      const hem = float(0.3).add(fold.mul(0.3))
      const band = smoothstep(hem.sub(0.12), hem.add(0.06), point.y).mul(smoothstep(0.95, 0.62, point.y)).mul(smoothstep(hem.add(0.45), hem, point.y).mul(0.7).add(0.3))
      const aurora = mix(auroraColor, fringeColor, smoothstep(hem.add(0.12), 0.9, point.y)).mul(curtain.mul(rays.mul(1.8).add(0.2)).mul(band).mul(wall).mul(3.2))
      return {
        absorption: float(0.5),
        density,
        color: lit,
        emission: aurora,
      }
    }, layers)
    // Beyond the storm, the night sky of the winter it is in, glowing round the crystal.
    const crystalMiss = origin.sub(crystalLight).sub(direction.mul(origin.sub(crystalLight).dot(direction))).length()
    const sky = mix(duskColor, nightColor, crystalMiss.smoothstep(0.1, 0.9)).mul(0.9)
    return {
      radiance: fill.radiance.add(sky.mul(fill.transmittance)),
      transmittance: fill.transmittance.mul(0.3),
    }
  }
}
