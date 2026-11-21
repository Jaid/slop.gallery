import type {Vec3} from 'math'

import Sculpture from '../base/Sculpture.ts'

export default class TungTungTungSahurSculpture extends Sculpture {
  readonly description = 'A log stands barefoot, its beater resting at its side. Wide, drilled eyes and a private smile are cut into the round of the trunk.'
  readonly id = 'tung_tung_tung_sahur'
  // About 1.35 m³ of carving stone at 2500 kg/m³.
  readonly mass = 3350
  readonly size: Vec3 = [1.857, 3.921, 1.065]
  readonly title = 'Tung Tung Tung Sahur'

  async loadModel() {
    const {default: Model} = await import('./components/TungTungTungSahurSculptureModel/index.tsx')
    return Model
  }
}
