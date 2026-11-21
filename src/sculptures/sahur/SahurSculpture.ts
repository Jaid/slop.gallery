import type {Vec3} from 'math'

import Sculpture from '../base/Sculpture.ts'

export default class SahurSculpture extends Sculpture {
  readonly description = 'A tall wooden log figure carved from solid stone, wide-eyed and smiling gently, standing barefoot with a baseball bat resting at his right side.'
  readonly id = 'sahur'
  // About 1.2 m³ of carving stone at 2500 kg/m³.
  readonly mass = 2990
  readonly size: Vec3 = [2.04, 3.8, 1.05]
  readonly title = 'Tung Tung Tung Sahur'

  async loadModel() {
    const {default: Model} = await import('./components/SahurSculptureModel/index.tsx')
    return Model
  }
}
