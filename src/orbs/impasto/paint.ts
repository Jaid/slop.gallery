import type {Node, NodeFrame, Renderer} from 'three/webgpu'

import {array, asin, atan, cos, float, Fn, instanceIndex, max, mix, nodeObject, select, sin, textureStore, uvec2, vec2, vec3, vec4} from 'three/tsl'
import {ClampToEdgeWrapping, HalfFloatType, LinearFilter, NodeUpdateType, RepeatWrapping, StorageTexture, TextureNode} from 'three/webgpu'

import {impastoColor, impastoIndex} from '#src/lib/materials/impastoPaints.ts'

import {rgb} from '../lib/fill.ts'
import {orbNoise} from '../lib/noise.ts'
import {courseHeight, impastoBall, impastoCap, impastoCourses, impastoOutline, impastoStrokes} from './strokes.ts'

type Float = Node<'float'>
type Vec3 = Node<'vec3'>

/** how high the paint of a stroke stands at most, as a share of {@link impastoBall}`.relief`, before the strokes under it lift it further */
const thickness = 0.48
/** how thick a stroke’s paint is at least where it lies over another, as a share of {@link impastoBall}`.relief`: it follows what lies under it there, so it never sinks into it, and steps up off it at its edge */
const draped = 0.16
/** the toned ground the painter laid the core in, which only shows in the deepest cracks between strokes */
const ground = rgb('#141c2c')
const counts = array(impastoCourses.map(course => float(course.count)))
const offsets = array(impastoCourses.map(course => float(course.offset)))
const starts = array(impastoCourses.map(course => float(course.start)))
const centers = array(impastoStrokes.map(entry => vec3(entry.center)))
const alongs = array(impastoStrokes.map(entry => vec3(entry.along)))
const acrosses = array(impastoStrokes.map(entry => vec3(entry.across)))
/** every stroke’s half length and half width, in radians, its load of paint and its seed */
const shapes = array(impastoStrokes.map(entry => vec4(entry.halfLength, entry.halfWidth, entry.load, entry.seed)))
/** every stroke’s paint, by its index in `impastoOrder`, and its place in the order the strokes were laid in */
const looks = array(impastoStrokes.map(entry => vec2(entry.paint, entry.layer)))

/** how much of the paint a lookup works out: only its shape for the march, its scoring too for the shading’s normals, or its color as well */
type Detail = 'paint' | 'relief' | 'shape'

/**
 * What one layer of paint does to a point: how much it covers it and how high its paint stands there, and, where the paint is asked for, its color and how glossy it is.
 * `soft` is the same layer without its scoring, fading in gently from its outline, which the layers laid over it drape over, so its edges show through them only as gentle swells, not as creases.
 */
type Layer = {
  color?: Vec3
  cover: Float
  gloss?: Float
  height: Float
  soft: {
    cover: Float
    height: Float
  }
}

/** where a layer’s softened twin starts and reaches its full height inside its outline, in radians round the ball; it never reaches past the outline, so it only ever comes from strokes the shader looks at */
const softEdge = [0, -0.1] as const
/** how gently a stroke laid over another blends from following it to being planed flat above it, as a share of {@link impastoBall}`.relief`, so the edges under it show as swells rather than creases */
const blend = 0.06
/** the larger of the two, rounded off over `k`, so the surface where they meet has no crease */
function smoothMax(a: Float, b: Float, k: number) {
  const h = float(k).sub(a.sub(b).abs()).max(0).div(k)
  return max(a, b).add(h.mul(h).mul(k / 4))
}
/** the smaller of the two, rounded off over `k` */
function smoothMin(a: Float, b: Float, k: number) {
  const h = float(k).sub(a.sub(b).abs()).max(0).div(k)
  return a.min(b).sub(h.mul(h).mul(k / 4))
}
/**
 * The knife stroke `index` of {@link impastoStrokes} at the direction `p` (unit, in the ball’s frame): a swathe set down along a rounded edge, dragged on and planed flat by the blade, thin where it set down, ridged along both sides where the paint squeezed out from under it, scratched along its length and heaped into a ragged lip where it lifted off.
 * Its outline follows `strokeMayCover` and `strokeSurelyCovers` of `strokes.ts`, which the tests check.
 */
function stroke(p: Vec3, index: Float, detail: Detail) {
  const i = index.toInt()
  const shape = shapes.element(i)
  const facing = p.dot(centers.element(i))
  const near = select(facing.greaterThan(0.2), float(1), float(0))
  const flat = facing.max(0.2)
  const x = p.dot(alongs.element(i)).div(flat).div(shape.x).toVar()
  const y = p.dot(acrosses.element(i)).div(flat).div(shape.y).toVar()
  const seed = shape.w
  // Both waver within −1–1, the sides gently, the lip more raggedly.
  const torn = x.mul(2.3).add(seed).sin().mul(0.7).add(x.mul(5.9).add(seed.mul(1.3)).sin().mul(0.3))
  const heaped = y.mul(3.7).add(seed.mul(2.1)).sin().mul(0.65).add(y.mul(8.3).add(seed).sin().mul(0.35))
  // How far outside its outline the point lies, in radians round the ball.
  const sides = y.abs().sub(torn.mul(impastoOutline.ragged).add(1)).mul(shape.y)
  const setDown = y.mul(y).mul(impastoOutline.setDown).sub(1).sub(x).mul(shape.x)
  const lipEdge = heaped.mul(impastoOutline.lip).add(1).toVar()
  const lip = x.sub(lipEdge).mul(shape.x)
  const outside = max(sides, setDown, lip).toVar()
  // Thin where the knife set down, then planed flat by the blade up to the heaped lip where it lifted off, with low ridges along both sides where the paint squeezed out from under it.
  const load = x.smoothstep(-1, -0.3).mul(0.5).add(0.5)
  const ridges = y.abs().sub(0.86).div(0.1).pow2().negate().exp().mul(0.14)
  // The lip follows the ragged edge the blade lifted off at, rising steeply from the planed flat and rolling over at the edge.
  const heap = lipEdge.sub(x).sub(0.13).div(0.11).pow2().negate().exp().mul(y.mul(y).mul(-0.55).add(1)).mul(0.36)
  const body = load.mul(0.6).add(ridges).add(heap).mul(shape.z).mul(thickness).toVar()
  const look = looks.element(i)
  // The blade’s nicks scored the planed flat along the way it was dragged, in streaks of their own spacing that fade out on the lip; too fine to change where the ray meets the paint, they only shade it.
  const frequency = seed.mul(0.61).fract().mul(4).add(7)
  const planed = heap.div(0.36).oneMinus()
  const streaks = orbNoise(vec3(x.mul(0.45).add(seed), y.mul(frequency), seed.mul(0.37)))
  // Each scratch is a few texels of the baked maps wide, so they resolve it.
  const scratches = float(1).sub(streaks.y.abs().mul(4)).max(0).pow2().mul(streaks.z.smoothstep(-0.1, 0.4))
  const scoring = detail === 'shape' ? float(0) : streaks.x.mul(0.014).sub(scratches.mul(0.018)).mul(planed).mul(thickness)
  // The cut edges round over quickly rather than standing up razor sharp.
  const bevel = outside.smoothstep(0, -0.016).sqrt()
  const layer: Layer = {
    cover: outside.smoothstep(0, -impastoOutline.edge).mul(near),
    height: body.add(scoring).mul(bevel),
    soft: {
      cover: outside.smoothstep(...softEdge).mul(near),
      height: body,
    },
  }
  if (detail === 'paint') {
    // Every stroke a little lighter or darker than its neighbors of the same paint, as the knife picked up more or less of it, the scratches a little darker.
    layer.color = impastoColor(look.x).mul(scratches.mul(-0.12).add(1)).mul(seed.mul(0.37).fract().mul(0.18).add(0.9))
    layer.gloss = ridges.div(0.14).max(heap.div(0.36))
  }
  return {
    layer,
    order: look.y,
  }
}
/** One of the knife’s twisted dabs on the poles of the ball, `side` 1 on the top, −1 on the bottom, laid last: a mound of titanium white on the top and cobalt teal on the bottom, wrung into a spiral by the turning blade, which heaped a ragged rim where it lifted off. */
function cap(p: Vec3, side: -1 | 1, detail: Detail): Layer {
  const facing = p.y.mul(side)
  const near = select(facing.greaterThan(0.5), float(1), float(0))
  const rho = vec2(p.x, p.z).length().div(facing.max(0.5)).toVar()
  const theta = atan(p.z, select(p.x.abs().add(p.z.abs()).lessThan(1e-6), float(1), p.x)).toVar()
  const ragged = theta.mul(5).add(side).sin().mul(0.6).add(theta.mul(11).sub(side).sin().mul(0.4))
  const outside = rho.sub(ragged.mul(impastoCap.ragged).add(1).mul(impastoCap.radius)).toVar()
  const r = rho.div(impastoCap.radius).toVar()
  // The paint winds round two arms of a spiral, tighter toward the middle.
  const spiral = theta.mul(2).add(r.sqrt().mul(10 * side)).toVar()
  const swirl = spiral.sin()
  const rim = r.sub(0.8).div(0.14).pow2().negate().exp()
  // The paint stands up in a coil along the arms where the blade wrung it.
  const coil = swirl.smoothstep(0.25, 0.55).mul(r.smoothstep(0.05, 0.35)).mul(rim.oneMinus())
  const body = float(1).sub(r.mul(r)).max(0).sqrt().mul(0.4).add(0.36).add(rim.mul(0.16)).add(coil.mul(0.1)).mul(thickness).toVar()
  const layer: Layer = {
    cover: outside.smoothstep(0, -impastoOutline.edge).mul(near),
    height: body.mul(outside.smoothstep(0, -0.016).sqrt()),
    soft: {
      cover: outside.smoothstep(...softEdge).mul(near),
      height: body,
    },
  }
  if (detail === 'paint') {
    layer.color = impastoColor(float(impastoIndex(side > 0 ? 'titaniumWhite' : 'cobaltTeal'))).mul(swirl.mul(0.04).add(1))
    layer.gloss = rim.max(coil.mul(0.7))
  }
  return layer
}
/**
 * The paint over the core at the direction `p` (unit, in the ball’s frame): its height, 0 on the bare core, and, for `paint` detail, its color and gloss.
 * Only the strokes that may reach it are laid: those of its cell and the next either way, in its course and the next either way, which `impastoCandidates` of `strokes.ts` mirrors. Each course lies over the one below, and within a course, the strokes are laid in their order, so every point shows the same overlaps the whole ball would.
 */
function paintAt(p: Vec3, detail: Detail) {
  const height = float(0).toVar()
  const soft = float(0).toVar()
  const color = ground.toVar()
  const gloss = float(0).toVar()
  /** Lays the layer over what is there: where its own paint stands higher, the blade planed it flat, and where the paint under it does, it is draped over it, so it starts flush with it at its edge and steps up off it. */
  const lay = ({color: paint, cover, gloss: shine, height: own, soft: blurred}: Layer) => {
    height.assign(mix(height, smoothMax(own, soft.add(smoothMin(own, float(draped), blend)), blend), cover))
    soft.assign(mix(soft, smoothMax(blurred.height, soft.add(smoothMin(blurred.height, float(draped), blend)), blend), blurred.cover))
    if (paint && shine) {
      color.assign(mix(color, paint, cover))
      gloss.assign(mix(gloss, shine, cover))
    }
  }
  const latitude = asin(p.y.clamp(-1, 1))
  const longitude = atan(p.z, select(p.x.abs().add(p.z.abs()).lessThan(1e-6), float(1), p.x))
  const course = latitude.add(Math.PI / 2).div(courseHeight).floor().clamp(0, impastoBall.courses - 1)
  for (const step of [-1, 0, 1]) {
    const neighbor = course.add(step)
    const valid = select(neighbor.greaterThanEqual(0).and(neighbor.lessThan(impastoBall.courses)), float(1), float(0))
    const entry = neighbor.clamp(0, impastoBall.courses - 1).toInt()
    const count = counts.element(entry)
    const start = starts.element(entry)
    const cell = longitude.div(Math.PI * 2).mul(count).sub(offsets.element(entry)).add(0.5).floor()
    const candidates = [-1, 0, 1].map(offset => {
      const wrapped = cell.add(offset)
      const result = stroke(p, start.add(wrapped.sub(count.mul(wrapped.div(count).floor()))), detail)
      result.layer.cover = result.layer.cover.mul(valid)
      return result
    })
    // Laid in their order, which differs from cell to cell round the course.
    const ranks = candidates.map(({order}, own) => candidates.reduce<Float>((rank, other, index) => (index === own ? rank : rank.add(select(order.greaterThan(other.order), float(1), float(0)))), float(0)).toVar())
    for (let rank = 0; rank < 3; rank++) {
      const pick = <T extends Node>(read: (layer: Layer) => T | undefined) => {
        const [first, second, third] = candidates.map(({layer}) => read(layer)!)
        return select(ranks[0].equal(rank), first, select(ranks[1].equal(rank), second, third)) as unknown as T
      }
      lay({
        cover: pick(layer => layer.cover),
        height: pick(layer => layer.height),
        soft: {
          cover: pick(layer => layer.soft.cover),
          height: pick(layer => layer.soft.height),
        },
        ...detail === 'paint' ? {
          color: pick(layer => layer.color),
          gloss: pick(layer => layer.gloss),
        } : {},
      })
    }
  }
  lay(cap(p, 1, detail))
  lay(cap(p, -1, detail))
  return {
    color,
    gloss,
    height,
  }
}

/** texels of the baked paint round the ball and from pole to pole: about 330 per radian, a few across the narrowest of its features, the scratches */
export const impastoMapSize = [2048, 1024] as const
const [mapWidth, mapHeight] = impastoMapSize
/** how far apart the bake samples the paint to find the slope of its scoring, in radians round the ball: a texel */
const slopeStep = Math.PI * 2 / mapWidth
/** A storage texture of the baked paint, wrapping round the ball and clamped at the poles, filtered between its texels. */
function paintMap(name: string, type?: typeof HalfFloatType) {
  const map = new StorageTexture(mapWidth, mapHeight)
  map.name = name
  if (type) {
    map.type = type
  }
  map.wrapS = RepeatWrapping
  map.wrapT = ClampToEdgeWrapping
  map.magFilter = LinearFilter
  map.minFilter = LinearFilter
  map.generateMipmaps = false
  return map
}
/** how high the paint stands by its shape alone, which the march follows, as a share of {@link impastoBall}`.relief`, and the slope its scoring adds to it toward the east and the north, per radian round the ball, which only the shading’s normals take in */
const reliefMap = paintMap('orb-impasto-relief', HalfFloatType)
/** the color of the paint, the square root of its linear color, so 8 bits keep the deep blues free of banding, and how glossy it is */
const colorMap = paintMap('orb-impasto-color')
/** How high the paint stands at the direction `p`, as a share of {@link impastoBall}`.relief`: single strokes about as they are, the tallest stacks of strokes pressed down so they never reach the ball’s outer shell, where the march starts. */
function heightAt(p: Vec3, detail: Detail) {
  const {height} = paintAt(p, detail)
  return height.div(height.pow(4).add(1).pow(0.25))
}
const directionLayout = (name: string) => ({
  name,
  type: 'float',
  inputs: [{
    type: 'vec3',
    name: 'p',
  }],
})
/** how high the paint stands at the direction `p` by its shape alone, compiled once as a function of its own, like {@link scoringAt}, rather than inlined wherever the bake samples it */
const shapeAt = Fn(([p]: [Vec3]) => heightAt(p, 'shape')).setLayout(directionLayout('impastoShape'))
/** how much higher the scoring stands at the direction `p` than the paint’s shape alone */
const scoringAt = Fn(([p]: [Vec3]) => heightAt(p, 'relief').sub(heightAt(p, 'shape'))).setLayout(directionLayout('impastoScoring'))
/** Paints the whole ball once, texel by texel, from its analytic strokes. The scoring’s streaks come from the orbs’ noise, whose lookup bakes its tile in a dispatch of its own submitted ahead of this one. */
const bake = Fn(() => {
  const x = instanceIndex.mod(mapWidth)
  const y = instanceIndex.div(mapWidth)
  const longitude = float(x).add(0.5).div(mapWidth).sub(0.5).mul(Math.PI * 2)
  const latitude = float(y).add(0.5).div(mapHeight).sub(0.5).mul(Math.PI)
  const p = vec3(cos(latitude).mul(cos(longitude)), sin(latitude), cos(latitude).mul(sin(longitude))).toVar()
  const {east, north} = tangents(longitude, latitude)
  const toward = (direction: Vec3, sign: number) => p.add(direction.mul(slopeStep * sign)).normalize()
  const slopeEast = scoringAt(toward(east, 1)).sub(scoringAt(toward(east, -1))).div(slopeStep * 2)
  const slopeNorth = scoringAt(toward(north, 1)).sub(scoringAt(toward(north, -1))).div(slopeStep * 2)
  const {color, gloss, height} = paintAt(p, 'paint')
  // Paint low among the strokes around it lies in their shade.
  const shaded = color.mul(height.smoothstep(0, 0.5).mul(0.3).add(0.7))
  textureStore(reliefMap, uvec2(x, y), vec4(shapeAt(p), slopeEast, slopeNorth, 1)).toWriteOnly()
  textureStore(colorMap, uvec2(x, y), vec4(shaded.max(0).sqrt(), gloss)).toWriteOnly()
})().compute(mapWidth * mapHeight)
/** Every renderer has its own device and copy of the maps, which it bakes the first time it draws an Impasto Orb. */
const baked = new WeakSet<Renderer>
/** How high the paint stands at the direction `p` (unit, in the ball’s frame) by its shape alone, as a share of {@link impastoBall}`.relief`. */
export function impastoHeight(p: Vec3) {
  return lookUp(reliefMap, p).x
}
/** The slope the scoring adds to the paint at the direction `p` along the ball’s surface, a tangent vector, in shares of {@link impastoBall}`.relief` per radian. */
export function impastoScoringSlope(p: Vec3) {
  const relief = lookUp(reliefMap, p)
  const {longitude, latitude} = coordinates(p)
  const {east, north} = tangents(longitude, latitude)
  return east.mul(relief.y).add(north.mul(relief.z))
}
/** The color of the paint at the direction `p`, already shaded where it lies low among the strokes around it, and how glossy it is. */
export function impastoLook(p: Vec3) {
  const look = lookUp(colorMap, p)
  return {
    color: look.rgb.mul(look.rgb),
    gloss: look.w,
  }
}
/** the unit directions east and north on the ball at the longitude and latitude */
function tangents(longitude: Float, latitude: Float) {
  return {
    east: vec3(sin(longitude).negate(), 0, cos(longitude)),
    north: vec3(sin(latitude).negate().mul(cos(longitude)), cos(latitude), sin(latitude).negate().mul(sin(longitude))),
  }
}
/** the longitude and latitude of the direction `p` (unit, in the ball’s frame) */
function coordinates(p: Vec3) {
  return {
    longitude: atan(p.z, select(p.x.abs().add(p.z.abs()).lessThan(1e-6), float(1), p.x)),
    latitude: asin(p.y.clamp(-1, 1)),
  }
}
/** A lookup of a map at the direction `p`, of its only level: the march reads it at depths jittered per pixel, where screen derivatives mean nothing. */
function lookUp(map: StorageTexture, p: Vec3) {
  const {longitude, latitude} = coordinates(p)
  return nodeObject(new PaintMapNode(map, vec2(longitude.div(Math.PI * 2).add(0.5), latitude.div(Math.PI).add(0.5)), float(0))) as unknown as Node<'vec4'>
}
/** A lookup into a map of the paint that bakes the maps first if this renderer hasn’t yet. */
class PaintMapNode extends TextureNode {
  constructor(value = reliefMap, uvNode: Node | null = null, levelNode: Node | null = null) {
    super(value, uvNode, levelNode)
    this.updateBeforeType = NodeUpdateType.FRAME
  }

  override updateBefore({renderer}: NodeFrame): undefined {
    if (renderer && !baked.has(renderer)) {
      baked.add(renderer)
      // A renderer that draws is initialized, so the dispatch is queued right away, ahead of the draw; only an uninitialized one would return a promise.
      renderer.compute(bake)?.catch((error: unknown) => console.error('The Impasto Orb’s paint could not be baked.', error))
    }
  }
}
