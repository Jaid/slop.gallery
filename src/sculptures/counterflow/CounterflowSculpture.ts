import type {Vec3} from 'math'

import Sculpture from '../base/Sculpture.ts'

export default class CounterflowSculpture extends Sculpture {
  readonly description = 'A ribbon of pale stone folds back through its own wake. The broad faces are hollowed like a scoop, while the edges turn inward to frame an opening that changes shape as you circle it.'
  readonly id = 'counterflow'
  /** About 1.6 m³ of stone at 2550 kg/m³. */
  readonly mass = 4100
  readonly size: Vec3 = [2.16, 3.28, 2.24]
  readonly title = 'Counterflow'

  async loadModel() {
    const {default: Model} = await import('./components/CounterflowSculptureModel/index.tsx')
    return Model
  }
}
