import Sculpture from '../base/Sculpture.ts'
import {hitchSize} from './config.ts'

export default class HitchSculpture extends Sculpture {
  readonly description = 'A trefoil carved as one continuous rope of stone, its impossible crossings suspended above a low oval foot. The same limestone as the Salon socket catches the light differently on every turn.'
  readonly id = 'hitch'
  readonly mass = 6000
  readonly size = hitchSize
  readonly title = 'Hitch'

  async loadModel() {
    const {default: Model} = await import('./components/HitchSculptureModel/index.tsx')
    return Model
  }
}
