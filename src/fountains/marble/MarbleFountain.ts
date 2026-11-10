import type {Vec3} from 'math'

import Fountain from '../base/Fountain.ts'
import fountain, {mainJetApex} from './config.ts'

/** The fountain of white marble with gadrooned bowls, see its {@link description}. */
export default class MarbleFountain extends Fountain {
  readonly description = 'A three-tier fountain of white Arabescato marble: an octagonal carved basin, fluted balusters carrying two gadrooned bowls whose scalloped lips overflow as veils, and a gilt finial crowned by a tall jet, with lily jets leaning out round it and eight gilt nozzles throwing arcs out of the basin into the lower bowl.'
  readonly height = mainJetApex
  readonly id = 'marble'
  readonly mouth: Vec3 = [0, fountain.jet.y, 0]
  readonly radius = fountain.radius
  readonly title = 'Marble fountain'

  async loadModel() {
    const {default: Model} = await import('./components/MarbleFountainModel/index.tsx')
    return Model
  }
}
