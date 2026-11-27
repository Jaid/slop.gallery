import type {SnowflakeDesign} from '#src/lib/materials/snowflake.ts'
import type {Node} from 'three/webgpu'

import {atan, float, If, Loop, max, min, mix, mx_cell_noise_vec3, mx_noise_float, screenSize, screenUV, select, smoothstep, time, vec2, vec3} from 'three/tsl'
import {Color, SRGBColorSpace} from 'three/webgpu'

import {frostColors} from '#src/lib/materials/frostColors.ts'
import {fernStar, snowflakeShape, stellarDendrite} from '#src/lib/materials/snowflake.ts'
import {turn} from '#src/orbs/lib/fill.ts'

import MoodScreen from '../base/MoodScreen.ts'

type Float = Node<'float'>
type Vec2 = Node<'vec2'>

/** how far the frost reaches in from each corner of the view once it has grown in full, and in from the middles of its edges, in short screen sides */
const frostReach = {
  corner: 0.42,
  edge: 0.065,
}
/** how ragged its front is, as a share of how far it reaches */
const ragged = 0.35
/**
 * The crystals of rime the frosted pane is grained with, packed so densely that they overlap, coarse and fine: how many fit across the short side of the screen, how deep into the frost they appear and how strongly they show.
 * Each sits at a place of its own, jittered a quarter of its spacing either way and at most half its spacing in radius, so the four places nearest a point are all that can reach it. It only appears once the frost has grown as deep as it lies, and grows from a dot, so the rime spreads crystal by crystal behind the ferns.
 */
const rimeLayers = [
  {
    cells: 40,
    from: 0.08,
    strength: 0.55,
  },
  {
    cells: 90,
    from: 0,
    strength: 0.45,
  },
] as const
/** the ferns rooted on the edges of the view, which grow in from them as far as the frost reaches: how many stand round the view at most, how far out past the edge their feet stand at most, in short screen sides, so they grow in from beyond it, and how strongly they show; two sets of them, between each other */
const rootedFerns = [
  {
    around: 70,
    beyond: 0.02,
    strength: 0.9,
  },
  {
    around: 110,
    beyond: 0.04,
    strength: 0.7,
  },
] as const
/** how thick a fern’s spine is at its foot and its feathers are, in pixels to either side, how far apart its feathers spring, as a share of its length but within bounds, in short screen sides, and how long they grow, as a share of its length */
const fern = {
  spine: 1.3,
  feather: 0.65,
  spacing: 0.035,
  closest: 0.006,
  farthest: 0.014,
  length: 0.16,
}
/** how much of the view behind it the frost pales and washes out, as frosted glass does, at most */
const frosting = 0.55
/**
 * The layers of snow blowing across the view, far to near: how many flakes fit across the short side of the screen, how fast they blow across and down it, in short sides a second, how big they are, as a share of the space each has, how many of the places hold one, how bright they are and how far the wind smears them along its way.
 * The nearest are close to the eye, large and soft, as out of focus as they are. Each flake sits within the middle fifth of its place, small enough that, smeared and softened, it never reaches past its place.
 */
const snowLayers = [
  {
    cells: 38,
    wind: [0.2, 0.12],
    size: 0.06,
    share: 0.5,
    light: 0.5,
    smear: 2.2,
  },
  {
    cells: 21,
    wind: [0.32, 0.19],
    size: 0.08,
    share: 0.4,
    light: 0.65,
    smear: 2.2,
  },
  {
    cells: 11,
    wind: [0.5, 0.29],
    size: 0.08,
    share: 0.3,
    light: 0.55,
    smear: 2.2,
  },
  {
    cells: 4.5,
    wind: [0.8, 0.46],
    size: 0.12,
    share: 0.18,
    light: 0.3,
    smear: 1.3,
  },
] as const
const rgb = new Color
/** a color in display space, as the frame is after the output transform */
const display = (hex: number) => {
  const {r, g, b} = rgb.set(hex).getRGB({
    r: 0,
    g: 0,
    b: 0,
  }, SRGBColorSpace)
  return vec3(r, g, b)
}
const frostWhite = display(frostColors.snow)
const frostBlue = display(frostColors.ice)
const glintColor = display(frostColors.glint)
/**
 * A fern at `along` in toward the middle of the view from its foot and `across` it, both in short screen sides, `reach` long, `pixel` of them a pixel wide: a spine tapering toward its tip, feathered on either side with needles angled in toward the tip at 60°, the needles shorter toward the tip. How much of the point it covers, 0–1.
 */
function fernAt(along: Float, across: Float, reach: Float, pixel: Float) {
  const tipward = along.div(reach.max(1e-4)).clamp()
  const onSpine = select(along.greaterThan(0).and(along.lessThan(reach)), float(1), float(0))
  const spineWidth = pixel.mul(tipward.oneMinus().mul(fern.spine - 0.4).add(0.4))
  const spine = spineWidth.sub(across.abs()).div(pixel).add(0.5).clamp().mul(onSpine)
  const sprung = along.sub(across.abs().mul(Math.tan(Math.PI / 6)))
  const spacing = reach.mul(fern.spacing).clamp(fern.closest, fern.farthest)
  const between = sprung.div(spacing).fract().sub(0.5).abs().mul(spacing).mul(Math.cos(Math.PI / 6))
  const featherLength = reach.mul(fern.length).mul(float(1).sub(sprung.div(reach.max(1e-4)).clamp()).mul(0.85).add(0.15))
  // Each needle tapers out to a point.
  const featherTaper = float(1).sub(across.abs().div(featherLength.max(1e-4))).clamp()
  const onFeather = select(sprung.greaterThan(0).and(sprung.lessThan(reach)), featherTaper, float(0))
  const feather = pixel.mul(fern.feather).mul(featherTaper.mul(0.6).add(0.4)).sub(between).div(pixel).add(0.5).clamp().mul(onFeather).mul(0.85)
  // A soft glow of finer crystals round the spine gives it body.
  const halo = smoothstep(pixel.mul(7), 0, across.abs()).mul(onSpine).mul(0.22)
  // fading out toward its tip, as the ice thins
  return spine.max(feather).max(halo).mul(float(1).sub(tipward.mul(0.6)))
}
/**
 * The ferns rooted on the edges of the view at `point`, in short screen sides from its middle, the view `half` as wide and high, where the frost has grown `front` deep: of the ferns standing in the column round the middle the point lies in and the ones on either side, the most that covers it. Each stands on the edge with its foot, tilted a little either way, and grows in as far as the frost has reached, each as far as it happens to.
 */
function edgeFerns(point: Vec2, half: Vec2, pixel: Float, front: Float, {around, beyond}: typeof rootedFerns[number], salt: number) {
  const column = atan(point.y, point.x).div(Math.PI * 2).mul(around)
  const covered = float(0).toVar()
  for (const x of [-1, 0, 1]) {
    const place = column.floor().add(x)
    const random = mx_cell_noise_vec3(vec3(place.sub(place.div(around).floor().mul(around)), 2.2, salt))
    const angle = place.add(random.x.mul(0.6).add(0.2)).div(around).mul(Math.PI * 2)
    const way = vec2(angle.cos(), angle.sin())
    // its foot a little beyond the edge, so it grows in from it
    const edge = half.x.div(way.x.abs().max(1e-4)).min(half.y.div(way.y.abs().max(1e-4)))
    const footRadius = edge.add(random.y.mul(beyond))
    // Ferns stand thickest toward the corners, where the frost is deepest, and only here and there along the middles of the edges.
    const corner = half.length()
    const present = select(random.x.lessThan(smoothstep(half.y, corner, edge).mul(0.75).add(0.25)), float(1), float(0))
    const foot = way.mul(footRadius)
    const tilt = random.z.sub(0.5).mul(0.7)
    const inward = vec2(way.x.mul(tilt.cos()).add(way.y.mul(tilt.sin())), way.y.mul(tilt.cos()).sub(way.x.mul(tilt.sin()))).negate()
    const offset = point.sub(foot)
    const along = offset.dot(inward)
    const across = offset.dot(vec2(inward.y.negate(), inward.x))
    const reach = edge.mul(random.y.mul(0.25).add(0.2)).add(random.y.mul(beyond))
    // It stops where the frost does, give or take.
    const grown = front.sub(random.x.mul(0.25).sub(0.1)).div(0.15).clamp()
    covered.assign(covered.max(fernAt(along, across, reach, pixel).mul(grown).mul(present).mul(random.z.mul(0.5).add(0.5))))
  }
  return covered
}
/**
 * The rime’s crystals at `point`, in crystals of the layer, `pixel` of them a pixel wide, where the frost has grown `front` deep: of the crystals at the four places nearest the point, the most that covers it, each turned its own way and of the design it rolled, growing from a dot as the front reaches it. How much of the point they cover, 0–1.
 * Nothing in the branches takes screen derivatives, which are undefined there.
 */
function rimeCrystals(point: Vec2, pixel: Float, front: Float, from: number, salt: number) {
  const nearest = point.sub(0.5).floor()
  const covered = float(0).toVar()
  // Loop in the shader so the shared output pipeline compiles each crystal design just once per layer.
  Loop(4, ({i}) => {
    const place = nearest.add(vec2(float(i.mod(2)), float(i.div(2))))
    const random = mx_cell_noise_vec3(vec3(place, salt))
    const growth = front.sub(random.z.mul(0.35).add(from)).div(0.22).clamp()
    const radius = growth.sqrt().mul(random.x.mul(0.2).add(0.3))
    const offset = point.sub(place.add(random.xy.mul(0.5).add(0.25)))
    // No branch or barb reaches past 1.05 radii. Skip its distance field outside even the antialiased edge.
    If(growth.greaterThan(0).and(offset.lengthSq().lessThan(radius.mul(1.05).add(pixel).pow2())), () => {
      const local = turn(offset, random.y.mul(Math.PI * 2)).div(radius)
      const cover = (shape: SnowflakeDesign) => {
        const crystal = snowflakeShape(local, shape)
        const inside = crystal.inside.mul(radius).div(pixel).add(0.5).clamp()
        covered.assign(covered.max(inside.mul(crystal.ridge.mul(0.4).add(0.6))))
      }
      If(random.x.greaterThanEqual(1 / 3).and(random.x.lessThan(2 / 3)), () => cover(fernStar)).Else(() => cover(stellarDendrite))
    })
  })
  return covered
}

/**
 * The Frost Orb’s screen: as its mood comes in, hoarfrost creeps over the view like over a window pane on a winter night, out of the corners first and farthest, thinly along the edges between them: ferns of ice rooted on the edges, each a hair-thin spine feathered on either side, grow in toward the middle, while the pane frosts over behind them in a mottled crust grained with rime, crystal by crystal, washing out what lies beyond it. Now and then a crystal’s facet catches the light. Snow blows across the view in gusts, slanting down with the wind, the far flakes fine and smeared into streaks, the nearest large, soft and out of focus.
 * While it holds, the frost’s front breathes in and out a little; as it leaves, the frost melts back into the corners and the snow dies down. The middle of the view stays clear of frost: nothing of it is worked out farther in than it reaches.
 */
export default class Hoarfrost extends MoodScreen {
  draw(frame: Node<'vec3'>): Node<'vec3'> {
    const short = min(screenSize.x, screenSize.y)
    const aspect = screenSize.div(short)
    // where the pixel is, in short screen sides, from the middle of the view
    const at = screenUV.sub(0.5).mul(aspect).toVar('frostAt')
    const half = aspect.mul(0.5)
    // how far in from the nearer edges it lies, and from the nearest corner
    const fromEdges = half.sub(at.abs()).toVar('frostFromEdges')
    const fromCorner = fromEdges.length()
    const fromEdge = min(fromEdges.x, fromEdges.y)
    const result = frame.toVar('frostResult')
    // How far it has grown: in along with the mood, back out as it leaves, breathing a little while it holds.
    const growth = this.arrival.smoothstep(0, 1).mul(this.presence).mul(this.stay.mul(0.6).sin().mul(0.03).add(1)).toVar('frostGrowth')
    // how deep into the frost the pixel lies: the round patch out of the nearest corner or the band along the nearest edge, whichever reaches it farther
    const depth = max(growth.mul(frostReach.corner).sub(fromCorner).div(frostReach.corner), growth.mul(frostReach.edge).sub(fromEdge).div(frostReach.edge)).toVar('frostDepth')
    If(depth.greaterThan(-ragged).and(growth.greaterThan(0)), () => {
      const warp = vec2(mx_noise_float(vec3(at.mul(4), 1.7)), mx_noise_float(vec3(at.mul(4), 4.3))).mul(0.04)
      const w = at.add(warp).toVar('frostWarp')
      const front = depth.add(mx_noise_float(vec3(w.mul(6), 2.1)).mul(ragged)).toVar('frostFront')
      // Ferns of ice grow in from the edges toward the middle of the view, while the pane frosts over behind them, grained with rime crystal by crystal.
      const pixel = float(1).div(short)
      let covered: Float = float(0)
      for (const [index, layer] of rootedFerns.entries()) {
        covered = covered.max(edgeFerns(w, half, pixel, front, layer, index * 5.1 + 2.5).mul(layer.strength))
      }
      let rime: Float = float(0)
      for (const [index, layer] of rimeLayers.entries()) {
        rime = rime.max(rimeCrystals(w.mul(layer.cells), float(layer.cells).div(short), front, layer.from, index * 3.7 + 0.5).mul(layer.strength))
      }
      const ferns = covered.toVar('frostFerns')
      const frosted = smoothstep(0, 0.75, front).toVar('frostFrosted')
      // The frosted pane is mottled, thicker in patches, and grainy.
      const stipple = mx_noise_float(vec3(w.mul(260), 6.1)).mul(0.5).add(0.5)
      const mottle = mx_noise_float(vec3(w.mul(11), 8.3)).mul(0.5).add(0.5)
      const crust = frosted.mul(stipple.mul(0.25).add(mottle.mul(0.45)).add(0.4)).clamp()
      const cover = crust.mul(0.55).max(rime.mul(frosted.mul(0.5).add(0.5))).max(ferns.mul(0.85)).clamp()
      // Behind the frost, the view pales and turns a cold blue, washed out like through frosted glass, without darkening.
      const luminance = frame.dot(vec3(0.2126, 0.7152, 0.0722))
      const washed = mix(frame, frostBlue.mul(0.3).add(luminance.mul(0.4)).add(0.25), frosted.mul(frosting))
      // Now and then a crystal’s facet catches the light, a round glint.
      const glints = w.mul(60)
      const cell = mx_cell_noise_vec3(vec3(glints.floor(), 3.1))
      const glint = smoothstep(0.3, 0.05, glints.fract().sub(cell.xy.mul(0.5).add(0.25)).length()).mul(cell.z.greaterThan(0.85).select(float(1), float(0))).mul(time.mul(cell.y.mul(2.5).add(0.8)).add(cell.x.mul(40)).sin().max(0).pow(12)).mul(ferns.max(rime))
      const crystal = mix(frostBlue.mul(0.7).add(0.25), frostWhite, ferns.max(rime).mul(0.7).add(0.3))
      result.assign(mix(washed, crystal, cover.mul(0.85)).add(glintColor.mul(glint)))
    })
    // Snow blowing across the view in gusts, sparser toward the middle, where the player looks.
    const sparse = smoothstep(0.1, 0.7, at.length()).mul(0.5).add(0.5).mul(this.strength)
    const gust = mx_noise_float(vec3(at.mul(1.6).sub(vec2(time.mul(0.45), time.mul(0.26))), time.mul(0.1))).mul(0.5).add(0.5).smoothstep(0.2, 0.8).mul(0.75).add(0.25)
    const snow = float(0).toVar('frostSnow')
    for (const [index, {cells, wind, light, share, size, smear}] of snowLayers.entries()) {
      const speed = Math.hypot(...wind)
      const windward = vec2(wind[0] / speed, wind[1] / speed)
      const q = at.add(vec2(time.mul(-wind[0]), time.mul(-wind[1]))).mul(cells)
      const sway = vec2(q.y.mul(0.37).add(time.mul(1.3)).add(index * 2.1).sin(), q.x.mul(0.29).add(time.mul(0.9)).add(index).cos()).mul(0.12)
      const place = q.add(sway)
      const seed = mx_cell_noise_vec3(vec3(place.floor(), index * 5.7 + 0.5))
      const offset = place.fract().sub(seed.xy.mul(0.2).add(0.4))
      // smeared along the wind
      const along = offset.dot(windward).div(smear)
      const across = offset.dot(vec2(windward.y.negate(), windward.x))
      const radius = float(size).mul(seed.z.div(share).mul(0.7).add(0.55))
      // Soft at the edge by about a pixel, or by much more for the nearest flakes, which are out of focus.
      const pixel = float(cells).div(short)
      const near = index === snowLayers.length - 1
      const soft = near ? radius.mul(0.85) : pixel.mul(1.5).add(radius.mul(0.3))
      const flake = smoothstep(radius.add(soft), radius.sub(soft).max(0), vec2(along, across).length()).mul(seed.z.lessThan(share).select(float(1), float(0)))
      snow.assign(max(snow, flake.mul(light).mul(near ? float(1) : gust)))
    }
    return mix(result, frostWhite, snow.mul(sparse))
  }
}
