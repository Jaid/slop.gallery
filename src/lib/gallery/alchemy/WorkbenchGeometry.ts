import IronTableGeometry from '../IronTableGeometry.ts'
import {alchemySink, workbench, workbenchPivot} from './alchemyMachine.ts'

/**
 * The workbench of the alchemy machine, see {@link workbench}: an iron table under a slab of soapstone with a round hole for the sink.
 * Its frame lines up with the world’s, its origin on the floor under the slab’s middle; the `top` is a piece of its own, which its collider follows round the hole.
 */
export default class WorkbenchGeometry extends IronTableGeometry {
  constructor() {
    super(workbench, [{
      center: [workbenchPivot[0], workbenchPivot[2]],
      radius: alchemySink.radius + alchemySink.thickness,
    }])
  }
}
