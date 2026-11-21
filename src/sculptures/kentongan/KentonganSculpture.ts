import type {Vec3} from 'math'

import Sculpture from '../base/Sculpture.ts'

export default class KentonganSculpture extends Sculpture {
  readonly description = 'A night watchman whose body is a slit log drum, carved with its beater from one stone. Fist on his hip and mouth wide open, he swings at the slot in his own belly: tung, tung, tung – time to wake for sahur.'
  readonly id = 'kentongan'
  // About 0.93 m³ of carving stone at 2500 kg/m³.
  readonly mass = 2330
  readonly size: Vec3 = [1.28, 3.44, 1.01]
  readonly title = 'Kentongan'

  async loadModel() {
    const {default: Model} = await import('./components/KentonganSculptureModel/index.tsx')
    return Model
  }
}
