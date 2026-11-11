import type {BufferGeometry} from 'three/webgpu'

/** a box collider for physics: center position and size dimensions */
export type TableCollider = {
  center: readonly [number, number, number]
  name: string
  size: readonly [number, number, number]
}

/**
 * An industrial workshop table in The Forge: a heavy metal top plate over a blackened wrought-iron frame
 * with sturdy legs, plinth footpads, structural aprons, and lower tie-bar stretchers.
 *
 * Legs and underframe geometry are inset so that no part below the room's baseboard height
 * clips into the wall baseboard.
 */
export default abstract class ForgeTable {
  abstract readonly apronDepth: number
  abstract readonly apronThickness: number
  abstract readonly footHeight: number
  abstract readonly footOut: number
  abstract readonly frontOverhang: number
  abstract readonly height: number
  abstract readonly legSize: readonly [number, number]
  abstract readonly length: number
  abstract readonly orientation: 'x' | 'z'
  abstract readonly rearOverhang: number
  abstract readonly sideOverhang: number
  abstract readonly stretcherHeight: number
  abstract readonly stretcherSize: number
  abstract readonly topThickness: number
  abstract readonly width: number

  /**
   * Generates physics colliders for the table.
   */
  abstract get colliders(): ReadonlyArray<TableCollider>

  get underTop() {
    return this.height - this.topThickness
  }

  /**
   * Builds the underframe geometry (legs, footpads, aprons, and stretchers).
   */
  abstract createFrameGeometry(): BufferGeometry

  /**
   * Builds the top slab geometry in table-local coordinates.
   */
  abstract createTopGeometry(): BufferGeometry
}
