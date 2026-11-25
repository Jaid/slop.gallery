import type {Node} from 'three/webgpu'

import hsl from 'okhsl'
import {acos, atan, color, cos, cross, float, Fn, fwidth, hash, If, log, mix, mx_fractal_noise_float, mx_noise_float, normalWorldGeometry, pow, select, sign, sin, smoothstep, sqrt, time, uint, vec2, vec3} from 'three/tsl'
import {Vector3} from 'three/webgpu'

export type NightSkyOptions = {
  /** toward the bright core of the Milky Way, on or near its band */
  galacticCenter: Vector
  /** the pole of the Milky Way: its band runs along the great circle at right angles to it */
  galacticPole: Vector
  /** toward the moon */
  moonDirection: Vector
  /** toward the sun below the horizon, which lights the moon’s face and so decides its phase */
  sunDirection: Vector
}
type Float = Node<'float'>
type Vec3 = Node<'vec3'>
type Vector = readonly [number, number, number]

/** the angular radius of the moon’s disc, about four times the real one, so its face reads through a roof light */
const moonRadius = Math.PI / 180
/** the linear radiance of the moon’s highlands where the sun lights them head-on, under the bloom threshold, so tone mapping leaves its seas apart from them; its glare blooms instead */
const moonRadiance = 1.8
/** the angular radius of the ice halo round the moon */
const haloRadius = 22 * Math.PI / 180
/** radians a pixel spans at the gallery’s field of view on 1080 rows, which the stars’ brightness is measured at */
const referencePixel = 0.0011
/** Sine of the elevation within which the gradient rounds off its minimum at the horizon. */
const horizonRounding = 0.015
/**
 * Layers of stars, each a grid of cells on the faces of a cube round the viewer, `cells` along each face’s edge, holding at most one star each:
 * how likely a cell holds one, the range of magnitudes its stars draw from, as many more at every fainter magnitude as in the sky, and how much they twinkle.
 */
const starLayers = [
  {
    cells: 36,
    density: 0.32,
    magnitudes: [-1.2, 3.6],
    twinkle: 1,
  },
  {
    cells: 120,
    density: 0.3,
    magnitudes: [3, 5.8],
    twinkle: 0.6,
  },
  {
    cells: 300,
    density: 0.22,
    magnitudes: [5, 7.6],
    twinkle: 0,
    milkyWay: true,
  },
] as const
/** the linear peak radiance of a magnitude 0 star a reference pixel wide */
const zeroMagnitude = 6
/** the shooting stars’ channels: how often each may streak across the sky, in seconds, and how likely it does */
const meteorChannels = [
  {
    period: 7.3,
    chance: 0.55,
  },
  {
    period: 11.9,
    chance: 0.6,
  },
] as const
const colors = {
  zenith: color(hsl.integer(265, 69, 5)),
  horizon: color(hsl.integer(263, 56, 12)),
  airglow: color(hsl.integer(166, 57, 12)),
  moonlitSky: color(hsl.integer(264, 59, 21)),
  halo: color(hsl.integer(263, 39, 72)),
  glare: color(hsl.integer(93, 21, 91)),
  moon: color(hsl.integer(83, 44, 94.6)),
  maria: color(hsl.integer(78, 8, 62)),
  bandCool: color(hsl.integer(269, 44, 74)),
  bandWarm: color(hsl.integer(82, 49, 84)),
  nebula: color(hsl.integer(5, 63, 57.5)),
  meteor: color(hsl.integer(252, 100, 93)),
  stars: [color(hsl.integer(271, 100, 74.5)), color(hsl.integer(271, 100, 91)), color(hsl.integer(75, 100, 97.3)), color(hsl.integer(74, 100, 89)), color(hsl.integer(59, 100, 79))],
}
/** The unit vector along `value`. */
const vector = (value: Vector) => {
  const unit = new Vector3(...value)
  unit.normalize()
  return vec3(unit.x, unit.y, unit.z)
}
/** One of the hashes of `seed`, the `index`th, from 0 up to 1. */
const draw = (seed: Node<'uint'>, index: number) => hash(seed.mul(uint(8)).add(uint(index)))

/**
 * A clear, moonlit night sky for a world direction, in linear radiance: a deep blue dome paling toward the horizon under a faint green airglow, thousands of stars twinkling in their own colors,
 * the Milky Way in clouds of light torn by dust lanes and touched by reddish nebulae, the moon’s lit face with its seas and its glare, aureole and ice halo, and now and then a shooting star.
 *
 * Stars are drawn about a pixel wide whatever the resolution, as bright in sum, so they neither shimmer nor swell. Only the moon’s disc, the brightest stars and the shooting stars rise above the gallery’s bloom threshold.
 */
export default function nightSky({galacticCenter, galacticPole, moonDirection, sunDirection}: NightSkyOptions, direction: Vec3 = normalWorldGeometry.normalize()) {
  const pole = vector(galacticPole)
  // The center, laid onto the band.
  const center = (() => {
    const axis = new Vector3(...galacticPole)
    axis.normalize()
    const onBand = new Vector3(...galacticCenter)
    onBand.addScaledVector(axis, -onBand.dot(axis))
    return vector(onBand.toArray())
  })()
  const along = cross(pole, center)
  const moon = vector(moonDirection)
  const sun = vector(sunDirection)
  return Fn(() => {
    const dir = direction.toVar('nightDirection')
    // How many radians a pixel spans here, taken before any branching.
    const pixel = fwidth(dir).length().mul(0.7).max(1e-5).toVar('nightPixel')
    const up = dir.y
    const height = up.mul(up).add(horizonRounding ** 2).sqrt().sub(horizonRounding)
    // The air glows faintly green a little over the horizon and dims the stars toward it.
    const airglow = up.sub(0.12).div(0.07).pow2().negate().exp()
    const clearness = smoothstep(-0.02, 0.35, up).toVar('nightClearness')
    const sky = mix(colors.horizon, colors.zenith, pow(height, float(0.5))).add(colors.airglow.mul(airglow.mul(0.6))).toVar('nightSky')
    // The moonlight scatters in the air before everything, even the moon’s unlit limb: a wide blue glow, a tighter aureole and its glare, ringed by the ice halo, reddish inside.
    const toMoon = dir.dot(moon).clamp(-1, 1).toVar('nightToMoon')
    const facing = toMoon.max(0)
    const haloOffset = acos(toMoon).sub(haloRadius)
    const moonlit = colors.moonlitSky.mul(facing.pow(3).mul(0.012).add(facing.pow(24).mul(0.02)))
      .add(colors.halo.mul(facing.pow(400).mul(0.09).add(facing.pow(60).mul(0.02))))
      .add(colors.glare.mul(facing.pow(4000).mul(0.6)))
      .add(mix(color(hsl.integer(34, 47, 53)), color(hsl.integer(265, 36, 75)), smoothstep(-0.01, 0.012, haloOffset)).mul(haloOffset.div(0.011).pow2().negate().exp().mul(0.0035)))
      .toVar('nightMoonlit')
    // The Milky Way: a band of light along the galactic equator, swelling round its core, in clouds broken by dark lanes of dust.
    const latitude = dir.dot(pole).toVar('nightLatitude')
    const starClouds = float(0).toVar('nightStarClouds')
    If(latitude.abs().lessThan(0.6), () => {
      const longitude = atan(dir.dot(along), dir.dot(center))
      const bulge = longitude.div(0.5).pow2().mul(-0.5).exp()
      const width = bulge.mul(0.12).add(0.1)
      const band = latitude.div(width).pow2().mul(-0.5).exp()
      const clouds = smoothstep(0.2, 0.85, mx_fractal_noise_float(dir.mul(3.2), 5, 2, 0.55).mul(0.5).add(0.5))
      const grain = mx_fractal_noise_float(dir.mul(13).add(4.1), 3, 2, 0.5).mul(0.5).add(0.5)
      // The great rift along the middle of the band, wandering a little and lifting in places, and patchy dust all over it.
      const riftLine = latitude.sub(mx_noise_float(dir.mul(2.3).add(9.7)).mul(0.035).add(0.012))
      const rift = riftLine.div(bulge.mul(0.016).add(0.018)).pow2().negate().exp().mul(smoothstep(-0.25, 0.45, mx_noise_float(dir.mul(1.4).add(2.3))))
      const dust = smoothstep(0.52, 0.82, mx_fractal_noise_float(dir.mul(7.5).add(1.7), 4, 2, 0.5).mul(0.5).add(0.5))
      const clear = float(1).sub(rift.max(dust.mul(0.75)).mul(0.88))
      const glow = band.mul(bulge.mul(1.6).add(0.4)).mul(clouds.mul(0.9).add(0.35)).mul(grain.mul(0.5).add(0.75)).mul(clear)
      starClouds.assign(band.mul(clear).mul(clouds.mul(0.6).add(0.4)))
      const hue = mix(colors.bandCool, colors.bandWarm, bulge.mul(0.75).add(clouds.mul(0.25)).clamp(0, 1))
      const nebulae = smoothstep(0.62, 0.86, mx_fractal_noise_float(dir.mul(5.5).add(7.3), 3, 2, 0.5).mul(0.5).add(0.5)).mul(band).mul(clear)
      sky.addAssign(hue.mul(glow.mul(0.08)).add(colors.nebula.mul(nebulae.mul(0.02))).mul(clearness))
    })
    // Stars, on the faces of a cube round the viewer: each layer looks at the four cells nearest to the point, so a star may sit anywhere in its cell.
    const size = dir.abs()
    const xMajor = size.x.greaterThanEqual(size.y).and(size.x.greaterThanEqual(size.z))
    const yMajor = xMajor.not().and(size.y.greaterThanEqual(size.z))
    const major = select(xMajor, size.x, select(yMajor, size.y, size.z))
    const side = select(xMajor, sign(dir.x), select(yMajor, sign(dir.y), sign(dir.z)))
    const face = select(xMajor, uint(0), select(yMajor, uint(2), uint(4))).add(select(side.lessThan(0), uint(1), uint(0))).toVar('nightFace')
    const onFace = dir.div(major).toVar('nightOnFace')
    const tangent = select(xMajor, vec3(0, 0, 1), vec3(1, 0, 0)).toVar('nightTangent')
    const bitangent = select(yMajor, vec3(0, 0, 1), vec3(0, 1, 0)).toVar('nightBitangent')
    const faceUV = vec2(onFace.dot(tangent), onFace.dot(bitangent)).mul(0.5).add(0.5).toVar('nightFaceUV')
    const sigma = pixel.mul(0.65).toVar('nightStarSigma')
    // Drawn wider than a reference pixel, a star keeps its brightness in sum.
    const spread = float(referencePixel * 0.65).div(sigma).pow2().toVar('nightStarSpread')
    const stars = vec3(0).toVar('nightStars')
    for (const [layerIndex, layer] of starLayers.entries()) {
      const {cells} = layer
      const [brightest, faintest] = layer.magnitudes
      const corner = faceUV.mul(cells).sub(0.5).floor()
      for (const [offsetX, offsetY] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
        const cell = corner.add(vec2(offsetX, offsetY))
        const inside = cell.x.greaterThanEqual(0).and(cell.y.greaterThanEqual(0)).and(cell.x.lessThan(cells)).and(cell.y.lessThan(cells))
        const clamped = cell.clamp(0, cells - 1)
        const seed = face.mul(uint(cells * cells)).add(clamped.y.toUint().mul(uint(cells))).add(clamped.x.toUint()).mul(uint(starLayers.length)).add(uint(layerIndex)).toVar()
        const density = 'milkyWay' in layer ? starClouds.mul(2.6).add(0.35).mul(layer.density) : float(layer.density)
        const exists = select(inside.and(draw(seed, 0).lessThan(density)), float(1), float(0))
        const spot = clamped.add(vec2(draw(seed, 1), draw(seed, 2))).div(cells).mul(2).sub(1)
        const star = onFace.add(tangent.mul(spot.x.sub(faceUV.x.mul(2).sub(1)))).add(bitangent.mul(spot.y.sub(faceUV.y.mul(2).sub(1)))).normalize()
        const apart = cross(dir, star).length()
        // As many more stars at every fainter magnitude as in the sky, about four times as many.
        const ratio = 10 ** (0.6 * (faintest - brightest)) - 1
        const magnitude = log(draw(seed, 3).mul(ratio).add(1)).div(Math.log(10) * 0.6).add(brightest)
        let flux: Float = magnitude.mul(-0.4 * Math.log(10)).exp().mul(zeroMagnitude)
        if (layer.twinkle > 0) {
          // Scintillating faster and deeper toward the horizon.
          const phase = draw(seed, 5)
          const depth = float(1).sub(up.max(0)).pow2().mul(0.35).add(0.12).mul(layer.twinkle)
          flux = flux.mul(sin(time.mul(phase.mul(4).add(2.5)).add(phase.mul(40))).mul(sin(time.mul(phase.mul(1.7).add(0.9)).add(phase.mul(17)))).mul(depth).add(1))
        }
        const temperature = draw(seed, 4)
        const [blue, white, cream, gold, orange] = colors.stars
        const tint = mix(mix(mix(mix(blue, white, smoothstep(0.02, 0.2, temperature)), cream, smoothstep(0.35, 0.6, temperature)), gold, smoothstep(0.7, 0.88, temperature)), orange, smoothstep(0.92, 0.99, temperature))
        stars.addAssign(tint.mul(flux.mul(spread).mul(apart.div(sigma).pow2().mul(-0.5).exp()).mul(exists)))
      }
    }
    sky.addAssign(stars.mul(clearness))
    // Shooting stars: each channel may streak once a period, somewhere up the sky, for about a second.
    for (const [index, {chance, period}] of meteorChannels.entries()) {
      const clock = time.add(index * 3.1)
      const slot = clock.div(period).floor()
      const seed = slot.toUint().mul(uint(7)).add(uint(index * 3 + 11)).toVar()
      const azimuth = draw(seed, 0).mul(Math.PI * 2)
      const elevation = draw(seed, 1).mul(0.6).add(0.55)
      const start = vec3(sin(azimuth).mul(cos(elevation)), sin(elevation), cos(azimuth).mul(cos(elevation))).toVar()
      const east = cross(vec3(0, 1, 0), start).normalize()
      const north = cross(start, east)
      const heading = draw(seed, 2).mul(Math.PI * 2)
      const travel = east.mul(cos(heading)).add(north.mul(sin(heading))).toVar()
      const duration = draw(seed, 3).mul(0.7).add(0.45)
      const begin = draw(seed, 4).mul(period - 1.5)
      const progress = clock.sub(slot.mul(period)).sub(begin).div(duration).toVar()
      const lit = progress.greaterThan(0).and(progress.lessThan(1)).and(draw(seed, 5).lessThan(chance))
      const reach = draw(seed, 6).mul(0.25).add(0.15)
      const head = progress.mul(reach)
      const angle = atan(dir.dot(travel), dir.dot(start))
      const across = dir.dot(cross(start, travel))
      const trail = smoothstep(head.sub(0.1), head, angle).mul(select(angle.lessThan(head.add(pixel)), float(1), float(0)))
      const width = pixel.mul(0.6).max(0.0003)
      const glow = trail.mul(across.div(width).pow2().mul(-0.5).exp()).mul(sin(progress.mul(Math.PI)).mul(3.5))
      sky.addAssign(colors.meteor.mul(glow.mul(select(lit, clearness, float(0)))))
    }
    // The moon’s disc covers everything behind it: its seas darker than its highlands, its face lit by the sun with the moon’s even, flat look and the unlit part faint in earthshine.
    const disc = sqrt(float(1).sub(toMoon.mul(toMoon)).max(0)).div(Math.sin(moonRadius)).toVar('nightMoonDisc')
    If(toMoon.greaterThan(Math.cos(moonRadius * 2)), () => {
      const right = cross(moon, vec3(0, 1, 0)).normalize()
      const top = cross(right, moon)
      const offset = dir.sub(moon.mul(toMoon)).div(Math.sin(moonRadius))
      const x = offset.dot(right)
      const y = offset.dot(top)
      const normal = right.mul(x).add(top.mul(y)).sub(moon.mul(sqrt(float(1).sub(x.mul(x)).sub(y.mul(y)).max(0)))).normalize()
      const seas = smoothstep(0.02, 0.28, mx_fractal_noise_float(normal.mul(2.1).add(5.3), 4, 2, 0.5))
      const craters = smoothstep(0.55, 0.85, mx_noise_float(normal.mul(16).add(2.2)).mul(0.5).add(0.5)).mul(0.25)
      const albedo = mix(colors.moon, colors.maria, seas.mul(0.75)).mul(craters.add(1))
      const incidence = normal.dot(sun)
      const emergence = normal.dot(moon.negate()).max(0.05)
      const lunar = incidence.max(0).div(incidence.max(0).add(emergence)).mul(2).mul(smoothstep(-0.03, 0.05, incidence))
      const surface = albedo.mul(lunar.mul(moonRadiance).add(0.012))
      const edge = pixel.div(Math.sin(moonRadius))
      const cover = float(1).sub(smoothstep(float(1).sub(edge), edge.add(1), disc))
      sky.assign(mix(sky, surface, cover))
    })
    return sky.add(moonlit).max(vec3(0))
  })()
}
