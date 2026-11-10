import type {Vec3} from 'math'

import Fountain from '../base/Fountain.ts'
import fountain, {crownHeight} from './config.ts'

/** The tall fountain of fossil limestone with scalloped veils and a ring of jets, see its {@link description}. */
export default class LimestoneFountain extends Fountain {
  readonly description = 'A three-tier fountain carved from fossil limestone, over five meters to the crown of its jet: an octagonal basin on a stepped foot with a gilt band laid into its rim, a turned baluster and stems carrying three brimming bowls whose overflow falls in scalloped veils, a ring of eight slender jets on gilt nozzles and a tall jet out of the gilt finial in its cup.'
  readonly height = crownHeight
  readonly id = 'limestone'
  readonly mouth: Vec3 = [0, fountain.jet.y, 0]
  readonly radius = fountain.radius
  readonly title = 'Limestone fountain'

  async loadModel() {
    const {default: Model} = await import('./components/LimestoneFountainModel/index.tsx')
    return Model
  }
}
