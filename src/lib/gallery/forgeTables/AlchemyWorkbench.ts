import type {TableCollider} from './base/ForgeTable.ts'
import type {BufferGeometry} from 'three/webgpu'

import {ExtrudeGeometry, Path, Shape} from 'three/webgpu'

import {mergeParts} from '../../geometry.ts'
import {alchemySink, workbench} from '../alchemy/alchemyMachine.ts'
import {place, roundedBox} from '../lodgeInterior/place.ts'
import ForgeTable from './base/ForgeTable.ts'

/**
 * The alchemy machine workbench against the middle of the Forge's south wall:
 * a heavy satin steel plate top with the round opening for the alchemy sink cut through its east end,
 * over a blackened hand-forged wrought-iron frame with four heavy square legs, plinth footpads,
 * aprons, and lower tie-bar stretchers.
 *
 * Its rear legs are set back 13 cm from the bench's back edge, ensuring they stand clearly
 * in front of the south wall's 14.5 cm projecting baseboard cap without clipping.
 */
export default class AlchemyWorkbench extends ForgeTable {
  readonly apronDepth = 0.09
  readonly apronThickness = 0.028
  readonly footHeight = 0.015
  readonly footOut = 0.01
  readonly frontOverhang = 0.06
  readonly height = workbench.height
  readonly legSize = [0.08, 0.08] as const
  readonly length = workbench.length
  readonly orientation = 'x' as const
  readonly rearOverhang = 0.13
  readonly sideOverhang = 0.08
  readonly stretcherHeight = 0.14
  readonly stretcherSize = 0.042
  readonly topThickness = workbench.top
  readonly width = workbench.depth

  override get colliders(): ReadonlyArray<TableCollider> {
    const {legPositions, legSize, stretcherHeight, stretcherSize, underTop} = this
    const [legW, legD] = legSize
    const {eastX, frontZ, rearZ, westX} = legPositions
    const apronZSpan = rearZ - frontZ - legD
    const rearStretcherSpan = eastX - westX - legW
    return [
      ...legPositions.legs.map(([x, z], index): TableCollider => ({
        name: `workbench-leg-${index}`,
        center: [x, underTop / 2, z],
        size: [legW, underTop, legD],
      })),
      {
        name: 'workbench-stretcher-west',
        center: [westX, stretcherHeight, (frontZ + rearZ) / 2],
        size: [stretcherSize, stretcherSize, apronZSpan],
      },
      {
        name: 'workbench-stretcher-east',
        center: [eastX, stretcherHeight, (frontZ + rearZ) / 2],
        size: [stretcherSize, stretcherSize, apronZSpan],
      },
      {
        name: 'workbench-stretcher-rear',
        center: [0, stretcherHeight, rearZ],
        size: [rearStretcherSpan, stretcherSize, stretcherSize],
      },
    ]
  }

  get legPositions() {
    const {frontOverhang, legSize: [legW, legD], length, rearOverhang, sideOverhang, width} = this
    const westX = -(length / 2 - sideOverhang - legW / 2)
    const eastX = length / 2 - sideOverhang - legW / 2
    const rearZ = width / 2 - rearOverhang - legD / 2
    const frontZ = -(width / 2 - frontOverhang - legD / 2)
    return {
      legs: [
        [westX, frontZ],
        [eastX, frontZ],
        [westX, rearZ],
        [eastX, rearZ],
      ] as const,
      westX,
      eastX,
      frontZ,
      rearZ,
    }
  }

  /** General overhang shorthand. */
  get overhang() {
    return this.frontOverhang
  }

  override createFrameGeometry(): BufferGeometry {
    const {apronDepth, apronThickness, footHeight, footOut, legPositions, legSize, stretcherHeight, stretcherSize, underTop} = this
    const [legW, legD] = legSize
    const {eastX, frontZ, rearZ, westX} = legPositions
    const parts: Array<BufferGeometry> = []
    // 4 legs with plinth footpads
    const legH = underTop - footHeight
    const legY = footHeight + legH / 2
    const legXCoords = [westX, eastX]
    const legZCoords = [frontZ, rearZ]
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
    const apronXSpan = eastX - westX + legW
    parts.push(
      place(roundedBox([apronXSpan, apronDepth, apronThickness], 0.003, 2), 0, apronY, frontZ),
      place(roundedBox([apronXSpan, apronDepth, apronThickness], 0.003, 2), 0, apronY, rearZ),
    )
    const apronZSpan = rearZ - frontZ - legD
    parts.push(
      place(roundedBox([apronThickness, apronDepth, apronZSpan], 0.003, 2), westX, apronY, (frontZ + rearZ) / 2),
      place(roundedBox([apronThickness, apronDepth, apronZSpan], 0.003, 2), eastX, apronY, (frontZ + rearZ) / 2),
    )
    // Corner gusset reinforcement plates
    const gussetSize = 0.07
    const gussetThick = 0.008
    for (const x of legXCoords) {
      const xDir = x === westX ? 1 : -1
      for (const z of legZCoords) {
        const zDir = z === frontZ ? 1 : -1
        parts.push(
          place(roundedBox([gussetSize, apronDepth * 0.7, gussetThick], 0.002, 1), x + xDir * (legW / 2 + gussetSize / 2), apronY, z),
          place(roundedBox([gussetThick, apronDepth * 0.7, gussetSize], 0.002, 1), x, apronY, z + zDir * (legD / 2 + gussetSize / 2)),
        )
      }
    }
    // Lower stretchers at east and west ends, plus rear stretcher along the back
    parts.push(
      place(roundedBox([stretcherSize, stretcherSize, apronZSpan], 0.003, 2), westX, stretcherHeight, (frontZ + rearZ) / 2),
      place(roundedBox([stretcherSize, stretcherSize, apronZSpan], 0.003, 2), eastX, stretcherHeight, (frontZ + rearZ) / 2),
      place(roundedBox([apronXSpan - legW * 2, stretcherSize, stretcherSize], 0.003, 2), 0, stretcherHeight, rearZ),
    )
    return mergeParts(parts)
  }

  override createTopGeometry(): BufferGeometry {
    const {height, length, topThickness, width} = this
    const ease = 0.004
    const [sinkX, , sinkZ] = alchemySink.center
    const [benchX, benchZ] = workbench.center
    const outline = new Shape
    outline.moveTo(-length / 2, -width / 2)
    outline.lineTo(length / 2, -width / 2)
    outline.lineTo(length / 2, width / 2)
    outline.lineTo(-length / 2, width / 2)
    outline.closePath()
    const hole = new Path
    hole.absarc(sinkX - benchX, -(sinkZ - benchZ), alchemySink.radius + alchemySink.thickness, 0, Math.PI * 2, true)
    outline.holes.push(hole)
    const slab = new ExtrudeGeometry(outline, {
      depth: topThickness - ease * 2,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: ease,
      bevelThickness: ease,
      bevelOffset: -ease,
      curveSegments: 72,
    })
    slab.rotateX(-Math.PI / 2).translate(0, height - topThickness + ease, 0)
    return slab
  }
}
