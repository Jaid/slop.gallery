import type {Vec3} from 'math'

import Sculpture from '../base/Sculpture.ts'

export default class AntiphonSculpture extends Sculpture {
  readonly description = 'Two fluted bells grow from one loop of stone. One calls across the room; the other turns up toward the skylight as if to answer.'
  readonly id = 'antiphon'
  // About 1.16 m³ of carving stone at 2500 kg/m³.
  readonly mass = 2900
  readonly size: Vec3 = [2.75, 4.04, 1.65]
  readonly title = 'Antiphon'

  async loadModel() {
    const {default: Model} = await import('./components/AntiphonSculptureModel/index.tsx')
    return Model
  }
}
