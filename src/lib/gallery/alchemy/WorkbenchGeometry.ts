import type {TableCollider} from '../forgeTables/index.ts'
import type {BufferGeometry} from 'three/webgpu'

import {AlchemyWorkbench} from '../forgeTables/index.ts'

export type WorkbenchCollider = TableCollider

/**
 * The workbench of the alchemy machine: a heavy satin steel plate top with eased edges
 * and the round hole of the sink cut through its east end, over a blackened hand-forged
 * wrought-iron frame with four heavy legs standing clear of the room baseboard.
 */
export default class WorkbenchGeometry {
  readonly colliders: ReadonlyArray<WorkbenchCollider>
  readonly frame: BufferGeometry
  readonly top: BufferGeometry

  constructor() {
    const bench = new AlchemyWorkbench
    this.top = bench.createTopGeometry()
    this.frame = bench.createFrameGeometry()
    this.colliders = bench.colliders
  }

  dispose() {
    this.frame.dispose()
    this.top.dispose()
  }
}
