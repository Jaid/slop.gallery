import type {Vec3} from 'math'

import Sculpture from '../base/Sculpture.ts'

export default class TungTungTungSahurSculpture extends Sculpture {
  readonly description = 'A grinning wooden watchman with enamel eyes and a long bat carved from a separate blank. The grain follows each piece, from the end grain on his crown to the handle in his fist.'
  readonly id = 'tung_tung_tung_sahur'
  readonly mass = 548
  readonly size: Vec3 = [1.76, 3.74, 0.95]
  readonly title = 'Tung Tung Tung Sahur'

  async loadModel() {
    const {default: Model} = await import('./components/TungTungTungSahurModel/index.tsx')
    return Model
  }
}
