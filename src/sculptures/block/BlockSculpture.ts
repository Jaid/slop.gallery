import Sculpture from '../base/Sculpture.ts'
import {blockSize} from './config.ts'
import metadata from './metadata.ts'

export default class BlockSculpture extends Sculpture {
  readonly description = 'An upright block with flat sawn faces and irregular chips along its upper and vertical edges, cut from the same stone as its socket.'
  readonly id = 'block'
  readonly mass = 1000
  readonly metadata = metadata
  readonly size = blockSize
  readonly title = 'Block'

  async loadModel() {
    const {default: Model} = await import('./components/BlockSculptureModel/index.tsx')
    return Model
  }
}
