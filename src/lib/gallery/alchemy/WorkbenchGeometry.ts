import IronTableGeometry from '../IronTableGeometry.ts'
import {alchemySink, workbench} from './alchemyMachine.ts'

/**
 * The workbench of the alchemy machine, see {@link workbench}: an iron table under a slab of soapstone with the round hole of the sink cut through its east end.
 * Its frame lines up with the world’s, its origin on the floor under the slab’s middle; the `top` is a piece of its own, which its collider follows round the hole.
 */
export default class WorkbenchGeometry extends IronTableGeometry {
  constructor() {
    const [sinkX, , sinkZ] = alchemySink.center
    const [benchX, benchZ] = workbench.center
    super(workbench, [{
      center: [sinkX - benchX, sinkZ - benchZ],
      radius: alchemySink.radius + alchemySink.thickness,
    }])
  }
}
