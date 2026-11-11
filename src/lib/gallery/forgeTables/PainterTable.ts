import type {TableCollider} from './base/ForgeTable.ts'
import type {BufferGeometry} from 'three/webgpu'

import {mergeParts} from '../../geometry.ts'
import {place, roundedBox} from '../lodgeInterior/place.ts'
import ForgeTable from './base/ForgeTable.ts'

/**
 * The painter's table in The Forge, positioned against the middle of the west wall:
 * a substantial satin steel plate top over a blackened hand-forged wrought-iron frame
 * with four square legs, plinth footpads, aprons, and lower tie-bar stretchers.
 *
 * Its rear legs are set back 13 cm from the table's back edge, ensuring they stand clearly
 * in front of the room's 14.5 cm projecting baseboard cap without clipping.
 */
export default class PainterTable extends ForgeTable {
  readonly apronDepth = 0.08
  readonly apronThickness = 0.025
  /** Number of boards (compatibility with PlankTable consumers). */
  readonly boards = 1
  readonly footHeight = 0.015
  readonly footOut = 0.01
  readonly frontOverhang = 0.06
  /** Board gap (compatibility with PlankTable consumers). */
  readonly gap = 0
  readonly height = 0.78
  readonly legSize = [0.075, 0.075] as const
  readonly length = 2.6
  readonly orientation = 'z' as const
  readonly rearOverhang = 0.13
  readonly sideOverhang = 0.08
  readonly stretcherHeight = 0.12
  readonly stretcherSize = 0.038

  readonly topThickness = 0.045
  readonly width = 0.95

  /** Apron tuple [depth, thickness] matching legacy table structures. */
  get apron() {
    return [this.apronDepth, this.apronThickness] as const
  }

  override get colliders(): ReadonlyArray<TableCollider> {
    const {height, legPositions, legSize, length, stretcherHeight, stretcherSize, topThickness, underTop, width} = this
    const [legW, legD] = legSize
    const {frontX, northZ, rearX, southZ} = legPositions
    const apronXSpan = frontX - rearX - legW
    const longStretcherSpan = southZ - northZ - legD
    return [
      {
        name: 'forge-table-top',
        center: [0, height - topThickness / 2, 0],
        size: [width, topThickness, length],
      },
      ...legPositions.legs.map(([x, z], index): TableCollider => ({
        name: `forge-table-leg-${index}`,
        center: [x, underTop / 2, z],
        size: [legW, underTop, legD],
      })),
      {
        name: 'forge-table-stretcher-north',
        center: [(rearX + frontX) / 2, stretcherHeight, northZ],
        size: [apronXSpan, stretcherSize, stretcherSize],
      },
      {
        name: 'forge-table-stretcher-south',
        center: [(rearX + frontX) / 2, stretcherHeight, southZ],
        size: [apronXSpan, stretcherSize, stretcherSize],
      },
      {
        name: 'forge-table-stretcher-long',
        center: [(rearX + frontX) / 2, stretcherHeight, 0],
        size: [stretcherSize, stretcherSize, longStretcherSpan],
      },
    ]
  }

  /** Shorthand for leg dimension matching legacy table structures. */
  get leg() {
    return this.legSize[0]
  }

  get legPositions() {
    const {frontOverhang, legSize: [legW, legD], length, rearOverhang, sideOverhang, width} = this
    const rearX = -width / 2 + rearOverhang + legW / 2
    const frontX = width / 2 - frontOverhang - legW / 2
    const southZ = length / 2 - sideOverhang - legD / 2
    const northZ = -(length / 2 - sideOverhang - legD / 2)
    return {
      legs: [
        [rearX, northZ],
        [rearX, southZ],
        [frontX, northZ],
        [frontX, southZ],
      ] as const,
      rearX,
      frontX,
      northZ,
      southZ,
    }
  }

  /** Longitudinal positions of leg pairs along the table's length (Z axis). */
  get legs() {
    const {northZ, southZ} = this.legPositions
    return [northZ, southZ] as const
  }

  /** Transverse distance from table centerline to legs. */
  get legX() {
    const {frontX, rearX} = this.legPositions
    return Math.abs(frontX - rearX) / 2
  }

  /** General overhang shorthand. */
  get overhang() {
    return this.frontOverhang
  }

  /** Shorthand for top thickness matching legacy table structures. */
  get top() {
    return this.topThickness
  }

  override createFrameGeometry(): BufferGeometry {
    const {apronDepth, apronThickness, footHeight, footOut, legPositions, legSize, stretcherHeight, stretcherSize, underTop} = this
    const [legW, legD] = legSize
    const {frontX, northZ, rearX, southZ} = legPositions
    const westLegX = rearX
    const eastLegX = frontX
    const parts: Array<BufferGeometry> = []
    // 4 legs with plinth footpads
    const legH = underTop - footHeight
    const legY = footHeight + legH / 2
    const legXCoords = [westLegX, eastLegX]
    const legZCoords = [northZ, southZ]
    for (const x of legXCoords) {
      for (const z of legZCoords) {
        parts.push(
          place(roundedBox([legW + footOut * 2, footHeight, legD + footOut * 2], 0.003, 2), x, footHeight / 2, z),
          place(roundedBox([legW, legH, legD], 0.004, 2), x, legY, z),
        )
      }
    }
    // Aprons directly beneath top plate
    const apronY = underTop - apronDepth / 2
    const apronZSpan = southZ - northZ + legD
    parts.push(
      place(roundedBox([apronThickness, apronDepth, apronZSpan], 0.003, 2), westLegX, apronY, 0),
      place(roundedBox([apronThickness, apronDepth, apronZSpan], 0.003, 2), eastLegX, apronY, 0),
    )
    const apronXSpan = eastLegX - westLegX - legW
    parts.push(
      place(roundedBox([apronXSpan, apronDepth, apronThickness], 0.003, 2), (westLegX + eastLegX) / 2, apronY, northZ),
      place(roundedBox([apronXSpan, apronDepth, apronThickness], 0.003, 2), (westLegX + eastLegX) / 2, apronY, southZ),
    )
    // Corner gusset reinforcement plates
    const gussetSize = 0.06
    const gussetThick = 0.008
    for (const x of legXCoords) {
      const xDir = x === westLegX ? 1 : -1
      for (const z of legZCoords) {
        const zDir = z === northZ ? 1 : -1
        parts.push(
          place(roundedBox([gussetSize, apronDepth * 0.7, gussetThick], 0.002, 1), x + xDir * (legW / 2 + gussetSize / 2), apronY, z),
          place(roundedBox([gussetThick, apronDepth * 0.7, gussetSize], 0.002, 1), x, apronY, z + zDir * (legD / 2 + gussetSize / 2)),
        )
      }
    }
    // Lower stretchers
    parts.push(
      place(roundedBox([apronXSpan, stretcherSize, stretcherSize], 0.003, 2), (westLegX + eastLegX) / 2, stretcherHeight, northZ),
      place(roundedBox([apronXSpan, stretcherSize, stretcherSize], 0.003, 2), (westLegX + eastLegX) / 2, stretcherHeight, southZ),
    )
    const longStretcherSpan = southZ - northZ - legD
    parts.push(
      place(roundedBox([stretcherSize, stretcherSize, longStretcherSpan], 0.003, 2), (westLegX + eastLegX) / 2, stretcherHeight, 0),
    )
    return mergeParts(parts)
  }

  override createTopGeometry(): BufferGeometry {
    const {height, length, topThickness, width} = this
    const ease = 0.004
    const topY = height - topThickness / 2
    return place(roundedBox([width, topThickness, length], ease, 2), 0, topY, 0)
  }
}
