import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {float, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, tangentLocal, time, vec2, vec3} from 'three/tsl'

import {rgb} from '../../candidates/claude_opus/lib/rgb.ts'
import {knotLength, tubeCircumference, tubeCoordinates} from '../../candidates/claude_opus/lib/tubeCoordinates.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Rose medallions: this many along the knot in each of three staggered rows around the tube. */
const rosesAlong = 26
const rosesAround = 3
const spacingAlong = knotLength / rosesAlong
const spacingAround = tubeCircumference / rosesAround
/** The opening in the stone, and how far behind the stone face the glass is set. */
const openingRadius = 0.112
const glassDepth = 0.022
const oculusRadius = 0.022
const petalRadius = 0.062
const roundelCenter = 0.084
const roundelRadius = 0.018
const petals = 8
const roundels = 16
const borderPieces = 32
/** Pot-metal glass: cobalt and ruby dominate as at Chartres, with emerald, gold, violet and pale silver-stain. */
const palette = [hsl.integer(265.3, 97.3, 27), hsl.integer(25, 99, 38), hsl.integer(149, 98.5, 38), hsl.integer(70, 97, 65), hsl.integer(299, 88, 28), hsl.integer(91, 41, 75), hsl.integer(263.5, 95, 36)]
const choose = (index: Node<'float'>) => {
  let result = rgb(palette[0])
  for (let i = 1;i < palette.length;i++) {
    result = mix(result, rgb(palette[i]), index.sub(i).abs().lessThan(0.5).select(float(1), float(0)))
  }
  return result
}
/** Coverage of a line of `width` around distance 0, filtered by the distance's screen footprint. */
const line = (distance: Node<'float'>, width: number) => {
  const footprint = distance.fwidth().max(1e-5)
  return distance.abs().smoothstep(footprint.mul(-0.5).add(width), footprint.add(width)).oneMinus()
}
/** Distance (in radians of arc) from the nearest radial divider of an n-fold symmetric sector pattern. */
const sectorEdge = (angle: Node<'float'>, count: number) => angle.div(TAU / count).fract().sub(0.5).abs().oneMinus().mul(0.5).oneMinus().mul(TAU / count)
const flag = (condition: Node<'bool'>) => condition.select(float(1), float(0))
/** The leaded glass of one rose, in the glass plane: its pieces, came and fine stone mullions. */
function roseGlass(x: Node<'float'>, y: Node<'float'>, roseSeed: Node<'vec3'>) {
  const radius = vec2(x, y).length()
  const angle = y.atan(x).add(Math.PI)
// Petals are cusped: their outline swells between the mullions.
  const petalOutline = angle.mul(petals / 2).cos().abs().pow(0.6).mul(-0.28).add(1).mul(petalRadius)
  const roundelAngle = angle.div(TAU / roundels).floor().add(0.5).mul(TAU / roundels)
  const roundelDistance = vec2(x.add(roundelAngle.cos().mul(roundelCenter)), y.add(roundelAngle.sin().mul(roundelCenter))).length()
  const inOculus = radius.lessThan(oculusRadius)
  const inPetal = radius.lessThan(petalOutline).and(inOculus.not())
  const inRoundel = roundelDistance.lessThan(roundelRadius)
  const borderStart = roundelCenter + roundelRadius + 0.004
  const inBorder = radius.greaterThan(borderStart)
  const petalDividers = sectorEdge(angle, petals).mul(radius)
  let came: Node<'float'> = radius.sub(oculusRadius).abs()
  came = came.min(radius.sub(petalOutline).abs().mul(0.9))
  came = came.min(roundelDistance.sub(roundelRadius).abs())
  came = came.min(radius.sub(borderStart).abs())
  came = came.min(inPetal.select(petalDividers, float(1)))
  came = came.min(inBorder.select(sectorEdge(angle.add(Math.PI / borderPieces), borderPieces).mul(radius), float(1)))
  const mullions = line(petalDividers, 0.003).mul(flag(inPetal))
// Symmetric per ring, alternating by sector, varied per rose.
  const alternating = angle.div(TAU / 16).floor().mod(2)
  const seed = roseSeed.x.mul(7).floor()
  const choice = inOculus.select(seed.add(3), inPetal.select(seed.add(alternating), inRoundel.select(seed.add(4), inBorder.select(seed.add(alternating.mul(2)).add(1), seed.add(5))))).mod(palette.length)
  const pieceSeed = angle.div(TAU / 16).floor().add(inPetal.select(float(0), float(20))).add(inRoundel.select(float(40), float(0))).add(roseSeed.y.mul(300))
  return {
    radius,
    angle,
    came,
    mullions,
    color: choose(choice),
    pieceId: cellNoiseVec3(vec3(pieceSeed, roseSeed.z.mul(50), 5.5)),
  }
}
/** A dark stone knot pierced by gothic rose windows, seen by the light that passes through them. The glass is set back behind the stone face, so walking past shifts it against the opening and reveals the lit stone jamb on the far side. Each rose has an oculus, eight cusped petals, sixteen roundels and a border, in lead came and fine stone mullions. An evening sun travels slowly along the inside of the knot, so the windows kindle, burn nearly white and fade in turn. Antique glass carries seeds, streaks and uneven thickness, and up close the painter's grisaille lines appear. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.25)
    this.name = knotData.id
    const {p, view, facing, near, intimate} = viewerFrame()
    const n = normalLocal.normalize()
    const alongDirection = tangentLocal.xyz.normalize()
    const aroundDirection = n.cross(alongDirection).normalize()
    const {along, around} = tubeCoordinates()
// Staggered rose lattice in tube space, in physical units centered on each rose.
    const u = along.mul(rosesAlong)
    const v = around.mul(rosesAround)
    const row = v.floor()
    const shift = row.mod(2).mul(0.5)
    const column = u.sub(shift).floor()
    const x = u.sub(shift).fract().sub(0.5).mul(spacingAlong)
    const y = v.fract().sub(0.5).mul(spacingAround)
    const surfaceRadius = vec2(x, y).length()
    const roseSeed = cellNoiseVec3(vec3(column.mod(rosesAlong), row.mod(rosesAround), 2.5))
// Parallax into the opening: where the line of sight meets the glass plane set behind the stone face.
    const cosView = view.dot(n).max(0.3)
    const glassX = x.sub(view.dot(alongDirection).div(cosView).mul(glassDepth))
    const glassY = y.sub(view.dot(aroundDirection).div(cosView).mul(glassDepth))
    const glass = roseGlass(glassX, glassY, roseSeed)
    const opening = surfaceRadius.lessThan(openingRadius)
// Inside the opening but past the glass's rim, the eye meets the jamb: the inner wall of the stone.
    const jamb = flag(opening).mul(glass.radius.smoothstep(openingRadius - 0.001, openingRadius + 0.001))
    const seeGlass = flag(opening).mul(jamb.oneMinus())
    const frame = line(surfaceRadius.sub(openingRadius), 0.0035)
// Ashlar masonry around the openings.
    const courseHeight = 0.034
    const courseCoordinate = y.div(courseHeight).add(row.mul(0.5))
    const course = courseCoordinate.floor()
    const blockPhase = x.div(0.07).add(course.mul(0.5))
    const jointDistance = courseCoordinate.fract().sub(0.5).abs().oneMinus().mul(0.5).oneMinus().mul(courseHeight).min(blockPhase.fract().sub(0.5).abs().oneMinus().mul(0.5).oneMinus().mul(0.07))
    const joint = line(jointDistance, 0.0012)
    const blockId = cellNoiseVec3(vec3(blockPhase.floor().add(column.mod(rosesAlong).mul(31)), course.add(row.mod(rosesAround).mul(17)), 3.5))
    const grit = mx_fractal_noise_float(p.mul(60), 3, 2, 0.5)
    const masonry = mix(rgb(hsl.integer(67, 12, 12)), rgb(hsl.integer(76, 15, 18)), blockId.x).mul(grit.mul(0.25).add(0.9)).mul(joint.mul(0.6).oneMinus())
// Came and mullions in the glass plane.
    const lead = line(glass.came, 0.0021).max(glass.mullions)
    const recess = glass.came.smoothstep(0.0021, 0.007).mul(0.4).add(0.6)
// Antique glass: uneven thickness, reamy streaks and tiny seed bubbles.
    const thickness = mx_fractal_noise_float(p.mul(28).add(glass.pieceId.mul(9)), 2, 2, 0.5).mul(0.35).add(glass.pieceId.x.mul(0.6)).add(0.6)
    const streakCoordinate = p.dot(vec3(0.3, 0.9, 0.2)).mul(170)
    const streaks = mx_noise_float(vec3(streakCoordinate, glass.pieceId.y.mul(10), 0)).mul(0.14).mul(streakCoordinate.fwidth().smoothstep(0.4, 1).oneMinus())
    const seedCoordinate = p.mul(320)
    const bubbles = mx_noise_float(seedCoordinate).smoothstep(0.55, 0.62).mul(seedCoordinate.fwidth().length().smoothstep(0.3, 0.7).oneMinus())
    const grisaillePhase = glass.radius.mul(380).add(glass.angle.mul(16).sin().mul(2.5))
    const grisaille = grisaillePhase.sin().smoothstep(0.8, 0.95).mul(grisaillePhase.fwidth().smoothstep(0.6, 1.6).oneMinus()).mul(intimate.mul(0.55).add(0.12))
// An amber evening sun gliding along the inside of the knot, over a steady dusk glow.
    const sunAlong = time.div(80).fract()
    const sunDistance = along.sub(sunAlong).add(0.5).fract().sub(0.5).mul(knotLength)
    const sun = sunDistance.div(0.8).pow2().negate().exp()
    const dusk = mx_noise_float(p.mul(1.3).add(vec3(0, 0, time.mul(0.03)))).mul(0.18).add(0.55)
    const backlight = mix(rgb(hsl.integer(71, 100, 85)), rgb(hsl.integer(79, 100, 96)), sun).mul(sun.mul(1.5).add(dusk))
// Where the sun stands right behind a pane, the glass nearly burns white.
    const transmitted = mix(glass.color, glass.color.add(0.35).mul(1.6), sun.pow(3).mul(0.45)).mul(thickness.add(streaks)).mul(bubbles.mul(0.8).add(1)).mul(grisaille.mul(0.85).oneMinus()).mul(recess)
// The deep opening shades the glass near its rim.
    const rimShade = surfaceRadius.smoothstep(openingRadius - 0.014, openingRadius).mul(0.55).oneMinus()
    const glassLight = transmitted.mul(backlight).mul(lead.oneMinus()).mul(rimShade).mul(near.mul(0.3).add(1.7))
// The jamb and the frame are lit by the window they hold; lead lines take a little halation from their panes.
    const jambLight = glass.color.add(0.15).mul(backlight).mul(0.18).mul(facing.oneMinus().mul(0.6).add(0.4))
    const halation = glass.color.mul(backlight).mul(lead).mul(0.3)
    const stoneMask = seeGlass.oneMinus()
    this.colorNode = mix(glass.color.mul(0.03).mul(lead.oneMinus()).add(rgb(hsl.integer(286, 6, 8)).mul(lead)), mix(masonry, rgb(hsl.integer(67, 10, 11)), jamb), stoneMask)
    this.metalnessNode = lead.mul(seeGlass).mul(0.4)
    this.roughnessNode = mix(mix(float(0.1), float(0.7), lead), float(0.93), stoneMask)
// Glass reflects only through a thin clearcoat, so its own reflection never veils the transmitted color.
    this.specularIntensityNode = stoneMask.max(lead)
    this.clearcoatNode = seeGlass.mul(lead.oneMinus()).mul(0.12)
    this.clearcoatRoughness = 0.05
// Stone: chiseled grit, sunken joints and a raised molding around each opening.
    this.normalNode = proceduralNormal(grit.mul(0.12).sub(joint.mul(0.5)).add(frame.mul(0.8)).mul(stoneMask).add(line(glass.came, 0.003).mul(0.4).mul(seeGlass)), 0.003)
// Spill: each window washes the stone around it with its dominant color, fading within a hand's breadth.
    const spillColor = choose(roseSeed.x.mul(7).floor().add(5).mod(palette.length)).add(choose(roseSeed.x.mul(7).floor().mod(palette.length))).mul(0.5)
    const spill = surfaceRadius.sub(openingRadius).max(0).div(0.025).negate().exp().mul(stoneMask).mul(jamb.oneMinus())
    this.emissiveNode = glassLight.mul(seeGlass).add(spillColor.add(0.1).mul(backlight).mul(spill).mul(0.22)).add(halation.mul(seeGlass)).add(jambLight.mul(jamb)).add(rgb(hsl.integer(65, 100, 79)).mul(sun).mul(frame).mul(0.05))
  }
}
