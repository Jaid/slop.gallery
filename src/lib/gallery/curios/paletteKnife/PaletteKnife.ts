import type {Vec3} from '../../types.ts'
import type {LatticePoint} from '../lattice.ts'
import type {BufferGeometry} from 'three/webgpu'

import {Color, ExtrudeGeometry, Shape} from 'three/webgpu'

import BrassMaterial from '#src/lib/materials/BrassMaterial.ts'
import BrushedMetalMaterial from '#src/lib/materials/BrushedMetalMaterial.ts'
import GrainedWoodMaterial from '#src/lib/materials/GrainedWoodMaterial.ts'
import {studioEnvironment} from '#src/lib/materials/metal.ts'
import OilPaintMaterial from '#src/lib/materials/OilPaintMaterial.ts'
import {oilPaints} from '#src/lib/materials/oilPaints.ts'

import {mergeParts} from '../../../geometry.ts'
import {salonBench} from '../../salon.ts'
import {withWoodGrain} from '../../woodGrain.ts'
import Curio, {CurioModel} from '../base/Curio.ts'
import latticeGeometry from '../lattice.ts'

type Rgb = readonly [number, number, number]
const linear = (hex: string): Rgb => {
  const {r, g, b} = new Color(hex)
  return [r, g, b]
}
const blend = ([r, g, b]: Rgb, [toR, toG, toB]: Rgb, share: number): Rgb => [r + (toR - r) * share, g + (toG - g) * share, b + (toB - b) * share]
const paints = {
  yellow: linear(oilPaints.cadmiumYellow),
  red: linear(oilPaints.vermilion),
  white: linear(oilPaints.titaniumWhite),
  blue: linear(oilPaints.ultramarine),
}
/** height of the handle’s axis so its widest belly rests on y = 0 */
const handleAxisY = 0.017
/** thickness of the steel trowel blade */
const bladeThickness = 0.0024
/** where the palette knife rests when a game begins: on the Salon’s velvet ottoman */
export const paletteKnifeSpot: Vec3 = [salonBench.position[0] - 0.52, salonBench.seatHeight + 0.002, salonBench.position[2] + 0.06]

/** A closed tube swept along z with radial profiles `[z, centerY, radiusX, radiusY]`. */
function tubeZ(rings: ReadonlyArray<readonly [z: number, y: number, rx: number, ry: number]>, around = 16) {
  const rows = rings.map(([z, y, rx, ry]) => Array.from({length: around}, (_, index): LatticePoint => {
    const angle = Math.PI * 2 * index / around
    return {position: [rx * Math.sin(angle), y + ry * Math.cos(angle), z]}
  }))
  const first = rings[0]
  const last = rings.at(-1)!
  return latticeGeometry(rows, {
    start: {position: [0, first[1], first[0] - 0.0005]},
    end: {position: [0, last[1], last[0] + 0.0005]},
  })
}
/** The turned rosewood handle along −z, resting on y = 0 at its belly. */
function handleGeometry(): BufferGeometry {
  const profile: Array<readonly [number, number, number, number]> = [
    [-0.168, handleAxisY, 0.006, 0.006],
    [-0.162, handleAxisY, 0.0115, 0.0115],
    [-0.145, handleAxisY, 0.0155, 0.0155],
    [-0.112, handleAxisY, 0.017, 0.017],
    [-0.072, handleAxisY, 0.0145, 0.0145],
    [-0.04, handleAxisY, 0.0115, 0.0115],
    [-0.022, handleAxisY, 0.0108, 0.0108],
  ]
  const geometry = withWoodGrain(tubeZ(profile, 20), (x, y, z) => [z, x + y * 0.3], 0.42)
  geometry.deleteAttribute('uv')
  return geometry
}
/** The tapered brass ferrule gripping the neck of the handle. */
function ferruleGeometry() {
  return tubeZ([
    [-0.024, handleAxisY, 0.0112, 0.0112],
    [-0.01, handleAxisY, 0.0102, 0.0102],
    [0.004, handleAxisY, 0.0082, 0.0082],
  ], 18)
}
/** The cranked steel shank stepping down from the ferrule to the flat trowel blade resting on y = 0. */
function bladeGeometry() {
  const shank = tubeZ([
    [0.002, handleAxisY, 0.0042, 0.0042],
    [0.022, handleAxisY - 0.002, 0.0034, 0.0032],
    [0.036, bladeThickness * 1.4, 0.0032, 0.0024],
    [0.048, bladeThickness / 2, 0.0038, bladeThickness / 2],
  ], 12)
  const outline = new Shape
  outline.moveTo(0.044, -0.004)
  outline.bezierCurveTo(0.058, -0.01, 0.076, -0.033, 0.095, -0.034)
  outline.bezierCurveTo(0.132, -0.034, 0.168, -0.012, 0.184, 0)
  outline.bezierCurveTo(0.168, 0.012, 0.132, 0.034, 0.095, 0.034)
  outline.bezierCurveTo(0.076, 0.033, 0.058, 0.01, 0.044, 0.004)
  outline.closePath()
  const trowel = new ExtrudeGeometry(outline, {
    depth: bladeThickness,
    bevelEnabled: false,
    curveSegments: 10,
  })
  // ExtrudeGeometry spans x in [0.044, 0.184] and z in [0, bladeThickness]; turn so blade lies along +z on y = 0.
  trowel.rotateX(-Math.PI / 2).rotateY(-Math.PI / 2)
  trowel.deleteAttribute('uv')
  return mergeParts([shank, trowel])
}
/** A thick, sculptural mound of unmixed impasto oil paint scooped onto the trowel blade. */
function paintScoopGeometry() {
  const rows = 8
  const around = 28
  const centerZ = 0.118
  const halfLen = 0.044
  const halfWid = 0.022
  const height = 0.018
  const lattice = Array.from({length: rows}, (_ignoredRow, row) => {
    const t = (row + 1) / (rows + 1)
    const rim = Math.sin(t * Math.PI * 0.5)
    return Array.from({length: around}, (_ignoredColumn, column): LatticePoint => {
      const u = Math.PI * 2 * column / around
      const ragged = 1 + 0.12 * Math.sin(3 * u + 0.7) + 0.06 * Math.cos(5 * u + 1.9)
      const x = Math.sin(u) * halfWid * rim * ragged
      const z = centerZ + Math.cos(u) * halfLen * rim * ragged
      // Piled higher into a curled knife crest toward the tip and right side.
      const ridge = 1 + 0.45 * Math.exp(-(((t - 0.35) / 0.25) ** 2)) * (0.5 + 0.5 * Math.cos(u - 0.6))
      const y = bladeThickness - 0.0002 + height * (1 - t ** 2.4) * ridge
      const swirl = 0.5 + 0.5 * Math.sin(u * 1.5 + z * 45 + x * 30)
      const base = blend(paints.yellow, paints.red, Math.min(1, Math.max(0, 0.5 + 0.5 * Math.sin(u + 0.8))))
      const pigment = blend(base, swirl > 0.65 ? paints.white : paints.blue, Math.max(0, swirl - 0.45) * 1.4)
      return {
        position: [x, y, z],
        values: pigment,
      }
    })
  })
  return latticeGeometry(lattice, {
    start: {
      position: [0.003, bladeThickness + height * 1.15, centerZ + 0.005],
      values: paints.white,
    },
    end: {
      position: [0, bladeThickness - 0.0003, centerZ],
      values: paints.yellow,
    },
    extra: {
      name: 'color',
      size: 3,
    },
  })
}

/**
 * A painter’s trowel palette knife loaded with thick impasto oil paint: turned rosewood handle, brass ferrule, cranked steel shank and diamond trowel blade bearing a sculpted mound of unmixed cadmium yellow, vermilion, titanium white and ultramarine.
 * Lying in the Salon on the velvet ottoman, it steers the flavor the Forge’s alchemy machine gives a Transparent Orb to an Impasto Orb.
 */
export default class PaletteKnife extends Curio {
  readonly id = 'palette-knife'
  readonly mass = 0.35
  readonly position = paletteKnifeSpot
  readonly reach = 0.28
  readonly room = 'salon'
  override readonly rotation: Vec3 = [0, 0.48, 0]
  readonly title = 'Palette Knife'

  createModel() {
    return new CurioModel([
      {
        name: 'palette-knife-wood',
        geometry: handleGeometry(),
        material: new GrainedWoodMaterial({
          heartwood: ['#8a4b26', '#b86d3b'],
          latewood: '#562912',
        }, {roughness: 0.4}),
      },
      {
        name: 'palette-knife-brass',
        geometry: ferruleGeometry(),
        material: new BrassMaterial,
      },
      {
        name: 'palette-knife-steel',
        geometry: bladeGeometry(),
        material: new BrushedMetalMaterial({environment: studioEnvironment}),
      },
      {
        name: 'palette-knife-paint',
        geometry: paintScoopGeometry(),
        material: new OilPaintMaterial,
      },
    ])
  }
}
