import type {Vec3} from '../../types.ts'
import type {LatticePoint} from '../lattice.ts'

import {BufferGeometry, Float32BufferAttribute} from 'three/webgpu'

import ForgedSteelMaterial from '#src/lib/materials/ForgedSteelMaterial.ts'
import GrainedWoodMaterial from '#src/lib/materials/GrainedWoodMaterial.ts'
import {studioEnvironment} from '#src/lib/materials/metal.ts'

import lodge from '../../lodge.ts'
import {lodgeHatchetHook} from '../../lodgeInterior/layout.ts'
import {withWoodGrain} from '../../woodGrain.ts'
import Curio, {CurioModel} from '../base/Curio.ts'
import latticeGeometry from '../lattice.ts'

const headRows = 26
const headColumns = 30
const handleAround = 24
const handleLength = 0.5
/** The curved cutting edge flares above and below the narrow eye of the head. */
function headGeometry() {
  const outline = Array.from({length: headRows}, (_ignoredRow, row) => Array.from({length: headColumns}, (_ignoredColumn, column) => {
    const along = row / (headRows - 1)
    const behindEdge = column / (headColumns - 1)
    const bottom = 0.282 + 0.068 * behindEdge ** 0.8
    const top = 0.528 - 0.075 * behindEdge ** 0.8
    const y = bottom + (top - bottom) * along
    const edgeX = -0.154 - 0.03 * (1 - (2 * along - 1) ** 2)
    const x = edgeX * (1 - behindEdge) + 0.08 * behindEdge
    const bevel = Math.min(1, behindEdge / 0.3) ** 1.15
    return {
      x,
      y,
      half: 0.00045 + 0.023 * bevel * (1 - 0.09 * Math.abs(2 * along - 1)),
      polish: Math.max(0.12, 1 - behindEdge / 0.35),
    }
  }))
  const positions: Array<number> = []
  const masks: Array<number> = []
  const indices: Array<number> = []
  const vertex = (x: number, y: number, z: number, polish: number) => {
    positions.push(x, y, z)
    masks.push(0, polish)
    return positions.length / 3 - 1
  }
  // Two smoothly curved cheeks, sharpened to the same thin edge.
  for (const side of [1, -1]) {
    const base = positions.length / 3
    for (const row of outline) {
      for (const {x, y, half, polish} of row) {
        vertex(x, y, side * half, polish)
      }
    }
    for (let row = 0; row < headRows - 1; row++) {
      for (let column = 0; column < headColumns - 1; column++) {
        const a = base + row * headColumns + column
        const [b, c, d] = [a + 1, a + headColumns, a + headColumns + 1]
        indices.push(...side > 0 ? [a, b, c, b, d, c] : [a, c, b, b, c, d])
      }
    }
  }
  // Close the curved edge, poll, top and bottom of the forged head.
  const rim = [
    ...outline[0],
    ...outline.slice(1).map(row => row.at(-1)!),
    ...outline.at(-1)!.toReversed().slice(1),
    ...outline.toReversed().slice(1).map(row => row[0]),
  ]
  for (let index = 0; index < rim.length - 1; index++) {
    const [from, to] = [rim[index], rim[index + 1]]
    const a = vertex(from.x, from.y, from.half, from.polish)
    const b = vertex(from.x, from.y, -from.half, from.polish)
    const c = vertex(to.x, to.y, to.half, to.polish)
    const d = vertex(to.x, to.y, -to.half, to.polish)
    indices.push(a, b, c, c, b, d)
  }
  const geometry = new BufferGeometry
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('steelMask', new Float32BufferAttribute(masks, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}
/** An ash haft, slightly bowed and slimmer in the grip, with a broad flared butt. */
function haftGeometry() {
  const rows = Array.from({length: 27}, (_ignoredRow, row) => {
    const y = handleLength - 0.49 * row / 26
    const grip = Math.exp(-(((y - 0.23) / 0.12) ** 2))
    const butt = Math.exp(-(((y - 0.052) / 0.046) ** 2))
    const halfWidth = 0.019 - 0.0038 * grip + 0.008 * butt
    const halfDepth = 0.014 - 0.002 * grip + 0.0035 * butt
    const bend = 0.008 * Math.sin(Math.PI * y / handleLength)
    return Array.from({length: handleAround}, (_ignoredColumn, column): LatticePoint => {
      const angle = Math.PI * 2 * column / handleAround
      return {
        position: [bend + halfWidth * Math.sin(angle), y, halfDepth * Math.cos(angle)],
      }
    })
  })
  return withWoodGrain(latticeGeometry(rows, {
    start: {position: [0, handleLength + 0.001, 0]},
    end: {position: [0, 0.004, 0]},
  }), (x, y, z) => [y, x + z * 0.35], 0.43)
}
/**
 * A short camp hatchet with a flared, honed forged-steel head and a curved ash haft.
 * It hangs by a leather loop from a hook on the Lodge’s fireplace pillar, and steers a Transparent Orb in the Forge to a Horror Orb.
 * In its own frame the haft rises along +y, and the blade points toward -x.
 */
export default class Hatchet extends Curio {
  readonly id = 'hatchet'
  readonly mass = 1.25
  readonly mood = 'horror'
  // Suspended in front of the right-hand pillar, with the head pointing down.
  readonly position: Vec3 = [
    lodge.center[0] + lodgeHatchetHook.position[0] + lodgeHatchetHook.hatchetOffset[0],
    lodge.floorY + lodgeHatchetHook.position[1] + lodgeHatchetHook.hatchetOffset[1],
    lodge.center[1] + lodgeHatchetHook.position[2] + lodgeHatchetHook.hatchetOffset[2],
  ]
  readonly reach = 0.37
  readonly room = 'lodge'
  // Turn the head downward while leaving the blade facing the outside of the hearth.
  override readonly rotation: Vec3 = [Math.PI, 0, 0]
  readonly title = 'A well-used hatchet, sharp as a warning'
  override readonly type = 'fixed'

  createModel() {
    return new CurioModel([
      {
        name: 'hatchet-steel',
        geometry: headGeometry(),
        material: new ForgedSteelMaterial({environment: studioEnvironment}),
      },
      {
        name: 'hatchet-haft',
        geometry: haftGeometry(),
        material: new GrainedWoodMaterial({
          heartwood: ['#69472a', '#a67b4d'],
          latewood: '#422b1a',
        }, {roughness: 0.57}),
      },
    ])
  }
}
