import type {Vec3} from '../../types.ts'
import type {GrainMapping} from '../../woodGrain.ts'
import type {LatticePoint} from '../lattice.ts'
import type {BufferGeometry} from 'three/webgpu'

import {attribute, float, mix, positionGeometry, vec3} from 'three/tsl'
import {Color, CylinderGeometry, ExtrudeGeometry, Float32BufferAttribute, Matrix4, MeshStandardNodeMaterial, Path, Shape, TorusGeometry, Vector3} from 'three/webgpu'

import BrushedMetalMaterial from '#src/lib/materials/BrushedMetalMaterial.ts'
import {inside} from '#src/lib/materials/filters.ts'
import GrainedWoodMaterial from '#src/lib/materials/GrainedWoodMaterial.ts'
import {studioEnvironment} from '#src/lib/materials/metal.ts'
import OilPaintMaterial from '#src/lib/materials/OilPaintMaterial.ts'

import {mergeParts} from '../../../geometry.ts'
import {forgeTable, forgeTableCenter} from '../../forge.ts'
import {rod, roundedBox} from '../../lodgeInterior/place.ts'
import {withWoodGrain} from '../../woodGrain.ts'
import Curio, {CurioModel} from '../base/Curio.ts'
import latticeGeometry from '../lattice.ts'

type Rgb = readonly [number, number, number]
const degree = Math.PI / 180
/** the box of the case: how wide, deep and high it is, and how thick its walls and its bottom are */
const box = {
  width: 0.4,
  depth: 0.28,
  height: 0.075,
  wall: 0.01,
  bottom: 0.008,
}
/** the lid: how deep it is from its rim to its back, how thick its back panel is, and how far it stands open from shut, a little past upright */
const lid = {
  depth: 0.028,
  panel: 0.008,
  open: 105 * degree,
}
/** the low dividers inside the box: how high they stand over its bottom and how thick they are, where the one running from front to back stands across, and where the one parting the left side into a front and a back compartment stands along */
const divider = {
  height: 0.05,
  thickness: 0.006,
  x: 0.07,
  z: -0.04,
}
/**
 * The artist’s palette lying in the lid, as seen with the lid open: an egg, half as wide as `reach` and half as tall as `rise` across its middle, broader toward its left end by `taper`, how thick it is, and where its thumb hole is and how wide.
 * Its right end is cut into a bay for the fingers, between a slender beak curling out over it and the round lobe under it: the bay leaves the egg at the angles round its middle in `bay`, and reaches in to its round end of the `radius` round the point `end`.
 */
const palette = {
  reach: 0.178,
  rise: 0.118,
  taper: 0.18,
  thickness: 0.005,
  hole: [0.075, -0.035, 0.021] as const,
  bay: {
    from: -0.15,
    to: 0.83,
    end: [0.1, 0.032] as const,
    radius: 0.02,
  },
}
/** Where the palette’s egg of an outline lies at the angle round its middle, seen with the lid open. */
function paletteEdge(angle: number): readonly [number, number] {
  const x = palette.reach * Math.cos(angle)
  return [x, palette.rise * (1 - palette.taper * x / palette.reach) * Math.sin(angle)]
}
/** the grain of a piece built along x, along z or standing up along y, seen from its own middle */
const alongX: GrainMapping = (x, y, z) => [x, z + y * 0.3]
const alongZ: GrainMapping = (x, y, z) => [z, x + y * 0.3]
/** the inner face of the box’s bottom */
const floor = box.bottom
/** the hinge line along the top of the box’s back */
const hinge = [box.height, -box.depth / 2] as const
const translation = (x: number, y: number, z: number) => {
  const matrix = new Matrix4
  return matrix.makeTranslation(x, y, z)
}
const turn = (axis: 'x' | 'y' | 'z', angle: number) => {
  const matrix = new Matrix4
  return {
    x: () => matrix.makeRotationX(angle),
    y: () => matrix.makeRotationY(angle),
    z: () => matrix.makeRotationZ(angle),
  }[axis]()
}
/** turns what is built into the shut lid open round the hinge */
const opening = translation(0, hinge[0], hinge[1]).multiply(turn('x', -lid.open)).multiply(translation(0, -hinge[0], -hinge[1]))
/** carries what is built on the palette, its face at y = 0 looking up and its top edge toward −z, into the open lid, its face looking out of it */
const onPalette = opening.clone().multiply(translation(0, box.height + lid.depth - lid.panel - palette.thickness, 0)).multiply(turn('x', Math.PI))
const linear = (hex: string): Rgb => {
  const {r, g, b} = new Color(hex)
  return [r, g, b]
}
const colors = {
  tube: linear('#ebe8e1'),
  cap: linear('#1d1c1b'),
  label: linear('#f4f2ec'),
  labelBand: linear('#3f8a4b'),
  oil: linear('#c4b768'),
  solvent: linear('#bfd19f'),
  bottleCap: linear('#f1efe9'),
  handle: linear('#6e3420'),
  knifeHandle: linear('#7a1d17'),
  bristles: linear('#e3d6b8'),
}
/** the color `share` of the way from one color to the other */
const blend = ([r, g, b]: Rgb, [toR, toG, toB]: Rgb, share: number): Rgb => [r + (toR - r) * share, g + (toG - g) * share, b + (toB - b) * share]
/** the paints, by their usual names */
const paints = {
  white: linear('#f3f0e6'),
  ochre: linear('#c98f2a'),
  yellow: linear('#f0bf12'),
  red: linear('#c1221b'),
  blue: linear('#22308e'),
  green: linear('#12624d'),
  umber: linear('#4d2b16'),
}
/** a ring of a {@link sweep}: where along the axis it lies, half its width and height across the axis and where its middle lies, by the axes across it in the order of `half`, how square it is, 2 being round, its color, and the level of the liquid behind it, if it is glass, see {@link fillLevels} */
type Ring = {
  at: number
  color?: Rgb
  fill?: number
  half: readonly [number, number]
  middle?: readonly [number, number]
  squareness?: number
}
/**
 * The `fillLevel` attribute the finish’s material reads: how high in the painting set’s own frame the liquid behind a part of a bottle’s glass stands, level however the bottle lies, which shows its own color below and bare glass above.
 * Everything else, labels and caps included, stands far below it, keeping its own color all over.
 */
const fillLevels = {
  name: 'fillLevel',
  /** a level high over anything, so nothing under it shows bare glass */
  none: 10,
}
/** Marks a part of the finish as nothing a liquid fills, so its own color shows all over. */
function dry<T extends BufferGeometry>(geometry: T) {
  if (!geometry.hasAttribute(fillLevels.name)) {
    const levels = new Float32Array(geometry.getAttribute('position').count)
    geometry.setAttribute(fillLevels.name, new Float32BufferAttribute(levels.fill(fillLevels.none), 1))
  }
  return geometry
}
/** Gives a part one color all over, for the materials taking vertex colors, dropping what no material of the set reads. */
function painted<T extends BufferGeometry>(geometry: T, color: Rgb) {
  geometry.deleteAttribute('uv')
  const values = new Float32Array(geometry.getAttribute('position').count * 3)
  for (let index = 0; index < values.length; index += 3) {
    values.set(color, index)
  }
  geometry.setAttribute('color', new Float32BufferAttribute(values, 3))
  return geometry
}
/** Drops what no material of the set reads from a part. */
function bare<T extends BufferGeometry>(geometry: T) {
  geometry.deleteAttribute('uv')
  return geometry
}
/** The sine or cosine of an angle bent toward a superellipse of the squareness, 2 being a circle. */
const superellipse = (value: number, squareness: number) => Math.sign(value) * Math.abs(value) ** (2 / squareness)
/**
 * A closed body swept along an axis through rings, each a superellipse, closed by a fan round the middle of its first and last ring, or round the `tip` beyond its first, facing out: along `y` from the top down, its rings measured across x and z; along `z` and `x` toward their far ends, measured across x and y or z and y.
 * With colors on its rings, it carries them as vertex colors; two rings in one place make a crisp edge between colors. With the level of a liquid on any of its rings, it carries those as {@link fillLevels}, on the rest none.
 */
function sweep(axis: 'x' | 'y' | 'z', rings: ReadonlyArray<Ring>, around: number, tip?: Ring) {
  const colored = rings.some(ring => ring.color)
  const point = ({at, color, middle: [first, second] = [0, 0]}: Pick<Ring, 'at' | 'color' | 'middle'>, across = 0, up = 0): LatticePoint => {
    const positions: Record<typeof axis, Vec3> = {
      x: [at, second + up, first - across],
      y: [first + across, at, second + up],
      z: [first + across, second + up, at],
    }
    const position = positions[axis]
    return colored ? {
      position,
      values: color ?? [1, 1, 1],
    } : {position}
  }
  const lattice = rings.map(ring => Array.from({length: around}, (_, index) => {
    const angle = Math.PI * 2 * index / around
    const squareness = ring.squareness ?? 2
    return point(ring, ring.half[0] * superellipse(Math.sin(angle), squareness), ring.half[1] * superellipse(Math.cos(angle), squareness))
  }))
  const geometry = latticeGeometry(lattice, {
    start: point(tip ?? rings[0]),
    end: point(rings.at(-1)!),
    ...colored ? {
      extra: {
        name: 'color',
        size: 3,
      },
    } : {},
  })
  if (rings.some(ring => ring.fill !== undefined)) {
    // In the lattice’s order: every ring’s points, then the middles of its first and its last
    const levels = [...rings.flatMap(ring => Array.from({length: around}, () => ring.fill ?? fillLevels.none)), (tip ?? rings[0]).fill ?? fillLevels.none, rings.at(-1)!.fill ?? fillLevels.none]
    geometry.setAttribute(fillLevels.name, new Float32BufferAttribute(levels, 1))
  }
  return geometry
}
/** Turns a part round y by `angle` and moves it to the point. */
function placed<T extends BufferGeometry>(geometry: T, [x, y, z]: Vec3, angle = 0) {
  return geometry.applyMatrix4(translation(x, y, z).multiply(turn('y', angle)))
}
/** A board of the case, a box with eased edges and its own grain, its middle at the point. */
function board(size: [number, number, number], mapping: GrainMapping, [x, y, z]: Vec3, seed: number) {
  return bare(withWoodGrain(roundedBox(size, 0.0025, 1), (px, py, pz) => {
    const [along, across] = mapping(px, py, pz)
    return [along + seed * 7.3, across]
  }, seed * 0.618034 % 1)).translate(x, y, z)
}
/** The box’s boards, its dividers and the lid’s boards, built shut and turned open. */
function woodwork() {
  const {bottom, depth, height, wall, width} = box
  const inner = height - bottom
  const [dividerY, dividerHeight] = [bottom + divider.height / 2, divider.height]
  const left = -width / 2 + wall
  const parts = [
    board([width, bottom, depth], alongX, [0, bottom / 2, 0], 1),
    ...[-1, 1].flatMap(side => [
      board([width, inner, wall], alongX, [0, bottom + inner / 2, side * (depth / 2 - wall / 2)], 2 + side),
      board([wall, inner, depth - wall * 2], alongZ, [side * (width / 2 - wall / 2), bottom + inner / 2, 0], 5 + side),
    ]),
    board([divider.thickness, dividerHeight, depth - wall * 2], alongZ, [divider.x, dividerY, 0], 8),
    board([divider.x - divider.thickness / 2 - left, dividerHeight, divider.thickness], alongX, [(left + divider.x - divider.thickness / 2) / 2, dividerY, divider.z], 9),
  ]
  // The lid, built shut over the box and turned open round the hinge
  const rim = lid.depth - lid.panel
  const shut = [
    board([width, lid.panel, depth], alongX, [0, height + lid.depth - lid.panel / 2, 0], 10),
    ...[-1, 1].flatMap(side => [
      board([width, rim, wall], alongX, [0, height + rim / 2, side * (depth / 2 - wall / 2)], 12 + side),
      board([wall, rim, depth - wall * 2], alongZ, [side * (width / 2 - wall / 2), height + rim / 2, 0], 15 + side),
    ]),
  ].map(part => part.applyMatrix4(opening))
  return mergeParts([...parts, ...shut])
}
/** The artist’s palette held in the open lid, see {@link palette}: an egg of a board with its finger bay and its thumb hole, its face looking out of the lid. */
function paletteBoard() {
  const {bay: {end: [endX, endY], from, radius, to}} = palette
  const outline = new Shape
  // Round the egg from the beak’s root the long way round to the lobe under the bay,
  const steps = 60
  outline.moveTo(...paletteEdge(to))
  for (let step = 1; step <= steps; step++) {
    outline.lineTo(...paletteEdge(to + (Math.PI * 2 - to + from) * step / steps))
  }
  // over the lobe’s rounded lip into the bay, along on the egg’s own heading,
  const [lobeX, lobeY] = paletteEdge(from)
  outline.bezierCurveTo(lobeX + 0.006, lobeY + 0.021, endX + 0.035, endY - radius, endX, endY - radius)
  // round its end,
  outline.absarc(endX, endY, radius, -Math.PI / 2, Math.PI / 2, true)
  // out under the beak, which droops a little toward its rounded tip,
  outline.bezierCurveTo(endX + 0.03, endY + radius + 0.001, endX + 0.055, endY + radius - 0.005, endX + 0.07, endY + radius - 0.011)
  outline.bezierCurveTo(endX + 0.082, endY + radius - 0.013, endX + 0.083, endY + radius + 0.006, endX + 0.068, endY + radius + 0.009)
  // and back along its back into the egg, on the egg’s own heading
  const [rootX, rootY] = paletteEdge(to)
  outline.bezierCurveTo(endX + 0.052, endY + radius + 0.012, rootX + 0.013, rootY - 0.007, rootX, rootY)
  const [holeX, holeY, holeRadius] = palette.hole
  const hole = new Path
  hole.absarc(holeX, holeY, holeRadius, 0, Math.PI * 2, true)
  outline.holes.push(hole)
  const ease = 0.001
  const slab = new ExtrudeGeometry(outline, {
    depth: palette.thickness - ease * 2,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: ease,
    bevelThickness: ease,
    bevelOffset: -ease,
    curveSegments: 24,
  })
  // The outline’s plane turns flat, its up toward −z, and the board lies under y = 0.
  slab.rotateX(-Math.PI / 2).translate(0, ease - palette.thickness, 0)
  return mergeParts([bare(withWoodGrain(slab, (x, y, z) => [x + 21, z + y * 0.3], 0.83)).applyMatrix4(onPalette)])
}
/** One of the paint tubes, lying in the box along z with its cap toward the back: a white tube banded in the color of its paint, its crimped end flattened down to the floor. */
function paintTube(paint: Rgb, [x, z]: readonly [number, number], angle: number, squeeze: number) {
  const {cap, tube} = colors
  const radius = 0.0125
  const length = 0.105
  const capLength = 0.013
  const rest = floor + radius
  /** the tube’s body, round behind its shoulder, dented where it was squeezed and flattening toward its crimp, lying on the floor all along */
  const body = (at: number, color: Rgb): Ring => {
    const flat = Math.min(1, Math.max(0, (at - 0.062) / (length - 0.012 - 0.062))) ** 1.4
    const dent = 1 - squeeze * Math.exp(-(((at - 0.05) / 0.012) ** 2))
    const halfHeight = radius * dent * (1 - flat) + 0.0013 * flat
    return {
      at,
      color,
      half: [radius + (0.017 - radius) * flat, halfHeight],
      middle: [0, floor + halfHeight],
    }
  }
  const band: [number, number] = [0.042, 0.068]
  const rings: Array<Ring> = [
    {
      at: capLength - 0.001,
      color: tube,
      half: [0.0045, 0.0045],
      middle: [0, rest],
    },
    {
      at: 0.016,
      color: tube,
      half: [0.0085, 0.0085],
      middle: [0, rest],
    },
    {
      at: 0.019,
      color: tube,
      half: [0.0115, 0.0115],
      middle: [0, rest],
    },
    ...[0.023, 0.032, band[0]].map(at => body(at, tube)),
    ...[band[0], 0.055, band[1]].map(at => body(at, paint)),
    ...[band[1], 0.075, 0.082, 0.088, length - 0.012].map(at => body(at, tube)),
    {
      ...body(length - 0.012, tube),
      at: length,
    },
  ]
  const shell = sweep('z', rings, 16)
  const capPart = painted(new CylinderGeometry(0.0072, 0.0072, capLength, 12), cap).rotateX(Math.PI / 2).translate(0, rest, capLength / 2)
  return [shell, capPart].map(part => placed(part, [x, 0, z], angle))
}
/** the medium bottles: half as wide and as deep as their flask is, and how high their flask reaches straight up from their foot before its shoulder */
const flask = {
  halfWidth: 0.022,
  halfDepth: 0.0135,
  height: 0.068,
}
/**
 * One of the medium bottles, built standing with the middle of its foot at the origin, placed by the matrix: a flat flask of glass with its oil standing in it up to the `level` in the painting set’s frame, level however the bottle lies, a white label banded in green round its middle and a white cap.
 */
function bottle(oil: Rgb, placement: Matrix4, level: number) {
  const {bottleCap, label, labelBand} = colors
  const {halfDepth, halfWidth} = flask
  const neck = 0.0092
  const body = (at: number, color: Rgb, scale = 1): Ring => ({
    at,
    color,
    half: [halfWidth * scale, halfDepth * scale],
    squareness: 4,
  })
  const glass = (ring: Ring): Ring => ({
    ...ring,
    color: oil,
    fill: level,
  })
  const shoulder = (at: number, share: number): Ring => glass({
    at,
    half: [halfWidth + (neck - halfWidth) * share, halfDepth + (neck - halfDepth) * share],
    squareness: 4 - 2 * share,
  })
  const rings: Array<Ring> = [
    glass({
      at: 0.096,
      half: [neck, neck],
    }),
    glass({
      at: 0.084,
      half: [neck, neck],
    }),
    shoulder(0.08, 0.85),
    shoulder(0.076, 0.55),
    shoulder(0.072, 0.2),
    glass(body(flask.height, oil)),
    glass(body(0.056, oil)),
    body(0.056, label),
    body(0.048, label),
    body(0.048, labelBand),
    body(0.042, labelBand),
    body(0.042, label),
    body(0.02, label),
    glass(body(0.02, oil)),
    glass(body(0.004, oil)),
    glass(body(0, oil, 0.92)),
  ]
  const capPart = dry(painted(new CylinderGeometry(0.0112, 0.0112, 0.02, 14), bottleCap).translate(0, 0.102, 0))
  return [sweep('y', rings, 24), capPart].map(part => part.applyMatrix4(placement))
}
/** how far the tipped bottle leans over from upright, against the box’s left wall */
const tipped = 22 * degree
/** where the inner face of the box’s left wall stands */
const leftFace = -box.width / 2 + box.wall
/**
 * The two bottles in the back compartment: one tipped over to the left, its foot standing on its left edge and its flank leaning against the top of the box’s left wall, and one lying flat on its broad side behind it, its cap toward the right.
 */
function bottles() {
  // The flank touches the wall’s inner top edge, so its foot stands as far out from the wall as the slope reaches over the wall’s height.
  const footX = leftFace + (box.height - floor) * Math.tan(tipped)
  const leaning = translation(footX, floor, -0.088).multiply(turn('y', -0.08)).multiply(turn('z', tipped)).multiply(translation(flask.halfWidth, 0, 0))
  // Its axis along x, its broad side down
  const flat = new Matrix4
  flat.makeBasis(new Vector3(0, 0, 1), new Vector3(1, 0, 0), new Vector3(0, 1, 0))
  const lying = translation(-0.098, floor + flask.halfDepth, -0.1).multiply(turn('y', 0.12)).multiply(flat)
  // The tipped one is filled to the top of its label, where it crosses its middle; the lying one a little over halfway up its depth, which reaches into its neck.
  const labelTop = new Vector3(0, 0.058, 0)
  return [...bottle(colors.oil, leaning, labelTop.applyMatrix4(leaning).y), ...bottle(colors.solvent, lying, floor + flask.halfDepth * 2 * 0.62)]
}
/** One of the two flat brushes, lying in the right compartment, built along x: a lacquered handle swelling toward its ferrule and the bristles beyond, `size` times as long, wide and thick as the small one’s, their tips dipped in a paint unless it is clean. */
function brush(paint: Rgb | undefined, [x, z]: readonly [number, number], angle: number, size = 1) {
  const {bristles, handle} = colors
  const thickest = 0.0046
  const rest = floor + thickest
  const round = (at: number, radius: number): Ring => ({
    at,
    color: handle,
    half: [radius, radius],
    middle: [0, rest],
  })
  const wood = sweep('x', [
    round(0, 0.0012),
    round(0.002, 0.0028),
    round(0.006, 0.0034),
    ...[[0.04, 0.0036], [0.08, 0.0042], [0.105, thickest], [0.13, 0.0042], [0.15, 0.0037]].map(([at, radius]) => round(at, radius)),
  ], 10)
  // Round where it grips the handle, flattening out to the bristles
  const [flatWidth, flatHeight] = [0.0058 * size, 0.0023 * size]
  const ferrule = (at: number, share: number): Ring => ({
    at,
    half: [0.0039 + (flatWidth - 0.0039) * share, 0.0039 + (flatHeight - 0.0039) * share],
    middle: [0, rest],
  })
  const metal = sweep('x', [ferrule(0.148, 0), ferrule(0.158, 0.1), ferrule(0.172, 0.7), ferrule(0.18, 1)], 12)
  const tuft = (along: number, halfWidth: number, halfHeight: number, color: Rgb): Ring => ({
    at: 0.179 + along * size,
    color,
    half: [halfWidth * size, halfHeight * size],
    middle: [0, rest],
    squareness: 3,
  })
  const tip = paint ?? bristles
  const hair = sweep('x', [
    tuft(0, 0.0054, 0.0021, bristles),
    tuft(0.009, 0.006, 0.0021, bristles),
    tuft(0.013, 0.006, 0.0019, tip),
    tuft(0.019, 0.0052, 0.0013, tip),
    tuft(0.0225, 0.0032, 0.0008, tip),
  ], 12)
  return {
    finish: [wood, hair].map(part => placed(part, [x, 0, z], angle)),
    metal: placed(metal, [x, 0, z], angle),
  }
}
/** The palette knife, lying in the right compartment beside the brushes, built along x: a pear-shaped lacquered handle, a ferrule, a cranked shank and a flat trowel of a blade lying on the floor. */
function paletteKnife([x, z]: readonly [number, number], angle: number) {
  const thickest = 0.0072
  const rest = floor + thickest
  const wood = sweep('x', [[0, 0.002], [0.002, 0.0042], [0.008, 0.0058], [0.03, thickest], [0.055, 0.0062], [0.082, 0.0048], [0.096, 0.0042]].map(([at, radius]): Ring => ({
    at,
    color: colors.knifeHandle,
    half: [radius, radius],
  })), 14)
  const ferrule = sweep('x', [
    {
      at: 0.094,
      half: [0.0044, 0.0044],
    },
    {
      at: 0.104,
      half: [0.0038, 0.0038],
    },
    {
      at: 0.11,
      half: [0.0028, 0.0028],
    },
  ], 10)
  const thickness = 0.0008
  const bladeY = thickest - thickness / 2
  const shank = [
    rod(new Vector3(0.108, 0, 0), new Vector3(0.132, 0, 0), 0.0014),
    rod(new Vector3(0.131, 0, 0), new Vector3(0.142, -bladeY, 0), 0.0012),
  ]
  const outline = new Shape
  outline.moveTo(0, -0.0015)
  outline.bezierCurveTo(0.012, -0.004, 0.02, -0.0105, 0.03, -0.0108)
  outline.bezierCurveTo(0.05, -0.011, 0.068, -0.004, 0.074, 0)
  outline.bezierCurveTo(0.068, 0.004, 0.05, 0.011, 0.03, 0.0108)
  outline.bezierCurveTo(0.02, 0.0105, 0.012, 0.004, 0, 0.0015)
  outline.closePath()
  const blade = new ExtrudeGeometry(outline, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 8,
  })
  blade.rotateX(-Math.PI / 2).translate(0.14, -bladeY - thickness / 2, 0)
  const lift = (part: BufferGeometry) => placed(part.translate(0, rest, 0), [x, 0, z], angle)
  return {
    finish: lift(wood),
    metal: [ferrule, ...shank.map(bare), bare(blade)].map(lift),
  }
}
/** The case’s chromed fittings: the bail handle folded down on its front between its two mounts, the catches beside it and the hinges along the back. */
function fittings() {
  const {depth, height} = box
  const front = depth / 2
  const handle = bare(new TorusGeometry(0.045, 0.0028, 6, 16, Math.PI)).scale(1, 0.55, 1).rotateZ(Math.PI).translate(0, 0.046, front + 0.009)
  const mounts = [-1, 1].map(side => bare(roundedBox([0.012, 0.016, 0.009], 0.002, 1)).translate(side * 0.045, 0.046, front + 0.0045))
  const catches = [-1, 1].map(side => bare(roundedBox([0.022, 0.02, 0.004], 0.0012, 1)).translate(side * 0.14, height - 0.012, front + 0.002))
  const hinges = [-1, 1].map(side => bare(new CylinderGeometry(0.0045, 0.0045, 0.045, 10)).rotateZ(Math.PI / 2).translate(side * 0.12, height, -front - 0.003))
  return [handle, ...mounts, ...catches, ...hinges]
}
/** A dollop of paint squeezed onto the palette, in the palette’s frame: a lumpy mound with its tip curled over, `radius` across and `height` tall, its foot sunk a little into the board. */
function dollop(color: Rgb, [x, z]: readonly [number, number], radius: number, height: number, seed: number) {
  const rows = 8
  const curl = 0.35 * radius
  const lean = seed * 2.4
  const rings = Array.from({length: rows}, (_, row): Ring => {
    const t = (row + 1) / rows
    const tip = curl * (1 - t) ** 2
    return {
      at: height * Math.cos(t * Math.PI / 2) ** 1.3 - 0.0004 * t,
      color,
      half: [radius * Math.sin(t * Math.PI / 2) ** 0.8, radius * Math.sin(t * Math.PI / 2) ** 0.8],
      middle: [x + tip * Math.cos(lean), z + tip * Math.sin(lean)],
    }
  })
  const tip = {
    at: height,
    color,
    middle: [x + curl * Math.cos(lean), z + curl * Math.sin(lean)] as const,
  }
  return lumpy(sweep('y', rings, 18, {
    ...tip,
    half: [0, 0],
  }), [x, z], seed)
}
/** A smear of paint pulled across the palette with the knife, in the palette’s frame: a low, ragged streak `length` long and `width` wide along the angle, mixing from one color into the other along it, piled up toward its end where the knife lifted off. */
function smear([from, to]: readonly [Rgb, Rgb], [x, z]: readonly [number, number], [length, width]: readonly [number, number], angle: number, thickness: number, seed: number) {
  const rows = 7
  const around = 44
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)]
  const lattice = Array.from({length: rows}, (_ignoredRow, row) => {
    const t = (row + 1) / rows
    return Array.from({length: around}, (_ignoredPoint, index): LatticePoint => {
      const u = Math.PI * 2 * index / around
      const ragged = 1 + 0.1 * Math.sin(3 * u + seed) + 0.05 * Math.sin(7 * u + seed * 3)
      const along = Math.sin(u) * length / 2 * Math.sin(t * Math.PI / 2) * ragged
      const across = Math.cos(u) * width / 2 * Math.sin(t * Math.PI / 2) * ragged
      const share = Math.min(1, Math.max(0, along / length + 0.5))
      // Ridges left by the knife’s edge across the streak, and the lip where it lifted off
      const ridges = 1 + 0.35 * Math.sin(along / length * 38 + seed)
      const lip = 1 + 1.6 * Math.exp(-(((share - 0.88) / 0.08) ** 2))
      return {
        position: [x + along * cos - across * sin, thickness * (1 - t ** 6) * ridges * lip - 0.0004 * t, z + along * sin + across * cos],
        values: blend(from, to, share),
      }
    })
  })
  return latticeGeometry(lattice, {
    start: {
      position: [x, thickness * 1.3, z],
      values: blend(from, to, 0.5),
    },
    end: {
      position: [x, -0.0004, z],
      values: blend(from, to, 0.5),
    },
    extra: {
      name: 'color',
      size: 3,
    },
  })
}
/** Pushes every point of a dollop round its middle in and out by lumps of its own, keeping its foot on the board. */
function lumpy(geometry: BufferGeometry, [x, z]: readonly [number, number], seed: number) {
  const position = geometry.getAttribute('position')
  for (let index = 0; index < position.count; index++) {
    const [px, py, pz] = [position.getX(index), position.getY(index), position.getZ(index)]
    const u = Math.atan2(px - x, pz - z)
    const lump = 1 + 0.13 * Math.sin(3 * u + seed) + 0.07 * Math.sin(5 * u + seed * 2.3) + 0.05 * Math.sin(py * 900 + u * 2 + seed)
    position.setXYZ(index, x + (px - x) * lump, py, z + (pz - z) * lump)
  }
  geometry.computeVertexNormals()
  return geometry
}
/** The paint on the palette, in its frame: dollops of every color in a row along its edge, from its broad left end round over its top toward the finger bay, and smears of white and of mixes worked across its middle. */
function palettePaint() {
  const {blue, green, ochre, red, umber, white, yellow} = paints
  // Where along the edge each dollop sits, by the angle round the palette’s middle, and how wide and tall it is
  const spots: ReadonlyArray<readonly [Rgb, number, number, number]> = [
    [white, 200, 0.016, 0.013],
    [yellow, 165, 0.012, 0.01],
    [ochre, 140, 0.012, 0.01],
    [red, 118, 0.012, 0.01],
    [green, 98, 0.012, 0.011],
    [blue, 80, 0.012, 0.011],
    [umber, 63, 0.0125, 0.011],
  ]
  // In the palette’s frame its top edge lies toward −z, so a place on the palette as seen goes in as [x, −y].
  const dollops = spots.map(([color, angle, radius, height], index) => {
    const [x, y] = paletteEdge(angle * degree)
    // Two fingers’ breadth in from the edge toward the middle
    const inward = 1 - 0.032 / Math.hypot(x, y)
    return dollop(color, [x * inward, -y * inward], radius, height, index + 1)
  })
  const smears = ([
    [[white, blend(white, red, 0.12)], [-0.035, -0.035], [0.11, 0.055], 0.25, 0.0026],
    [[blend(blue, white, 0.35), blend(green, white, 0.3)], [0.005, -0.08], [0.07, 0.03], -0.5, 0.0022],
    [[blend(yellow, red, 0.35), blend(ochre, white, 0.2)], [-0.035, 0.03], [0.05, 0.024], 0.4, 0.002],
  ] as const).map(([pair, [x, y], size, angle, thickness], index) => smear(pair, [x, -y], size, angle, thickness, index + 1))
  return [...dollops, ...smears].map(part => part.applyMatrix4(onPalette))
}
/**
 * The lacquer, printed tin and glass of the tubes, bottles and handles, in the colors their geometry carries: below a bottle’s {@link fillLevels} the color of its liquid, glossy, and bare glass above, glossier still, parted by a sharp, level line however finely the bottle is built.
 */
function finishMaterial() {
  const material = new MeshStandardNodeMaterial({envMapIntensity: 0.6})
  const filled = inside(positionGeometry.y.sub(attribute<'float'>(fillLevels.name, 'float')))
  material.colorNode = mix(vec3(...linear('#89958f')), attribute<'vec3'>('color', 'vec3'), filled)
  material.roughnessNode = mix(float(0.08), float(0.3), filled)
  return material
}
/** where the painting set lies when a game begins: open on the Forge’s painter’s table, its front turned out into the room and a little toward its south-east corner */
export const paintingSetSpot: Vec3 = [forgeTableCenter[0], forgeTable.height + 0.004, forgeTableCenter[1] + 0.1]

/**
 * A painter’s box of oils, standing open: a walnut case with its lid raised past upright, a pale artist’s palette held in the lid, daubed with dollops of fresh paint and smeared with mixes, and in the box, between low dividers, five tubes of paint in the front compartment, two bottles of oil fallen over in the back one, and two flat brushes and a palette knife in the long one on the right.
 * Lying in the Forge, it steers the flavor the alchemy machine gives a Transparent Orb to a Paint Orb.
 * In its own frame its box stands on its bottom at the origin, its front, with the handle, looking along z.
 */
export default class PaintingSet extends Curio {
  readonly id = 'painting-set'
  readonly mass = 2.4
  readonly position = paintingSetSpot
  readonly reach = 0.38
  readonly room = 'forge'
  override readonly rotation: Vec3 = [0, 1.25, 0]
  readonly title = 'Painting Set'

  createModel() {
    const {blue, green, red, umber, yellow} = paints
    // Each turned round its cap a little, fanning out toward the front; the green one put back askew, its crimp swung over toward the umber’s
    const tubes = ([[yellow, -0.15, -0.05], [red, -0.105, -0.025], [blue, -0.06, 0], [green, -0.022, 0.2], [umber, 0.03, 0.05]] as const).flatMap(([paint, x, angle], index) => paintTube(paint, [x, -0.028 + index % 2 * 0.008], angle, 0.1 + 0.08 * (index % 3)))
    // Built along x from their butts, turned to lie from the front toward the back, where the dividers and the box’s front leave their ends in view: a small one dipped in blue and a big clean one
    const brushes = [brush(blue, [0.131, 0.12], Math.PI / 2 + 0.02), brush(undefined, [0.162, 0.118], Math.PI / 2 - 0.025, 2)]
    const knife = paletteKnife([0.096, 0.116], Math.PI / 2 - 0.03)
    return new CurioModel([
      {
        name: 'painting-set-wood',
        geometry: woodwork(),
        // Stained walnut, so the pale palette stands out against it
        material: new GrainedWoodMaterial({
          heartwood: ['#3e2213', '#5f3a22'],
          latewood: '#28150b',
        }, {roughness: 0.45}),
      },
      {
        name: 'painting-set-palette',
        geometry: paletteBoard(),
        // Pale beech
        material: new GrainedWoodMaterial({
          heartwood: ['#d2ab7c', '#e8c9a0'],
          latewood: '#bb9064',
        }, {roughness: 0.55}),
      },
      {
        name: 'painting-set-finish',
        geometry: mergeParts([...tubes, ...bottles(), ...brushes.flatMap(({finish}) => finish), knife.finish].map(dry)),
        material: finishMaterial(),
      },
      {
        name: 'painting-set-metal',
        geometry: mergeParts([...fittings(), ...brushes.map(({metal}) => metal), ...knife.metal]),
        material: new BrushedMetalMaterial({environment: studioEnvironment}),
      },
      {
        name: 'painting-set-paint',
        geometry: mergeParts(palettePaint()),
        material: new OilPaintMaterial,
      },
    ])
  }
}
