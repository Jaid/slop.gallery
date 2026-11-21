import optis from 'optis'
import readPermalink from 'read-permalink'

import {isCanvasMaterialId} from './canvasMaterialIds.ts'

const materialId = (value: unknown) => (isCanvasMaterialId(value) ? value : undefined)
const schema = optis({normalizations: {
  canvas_material: materialId,
  new_canvas_material: materialId,
}})

/** Read the independent canvas material overrides for native portraits and for imports and fusion results. */
export default function readCanvasMaterialParameters(input: URL | string = typeof location === 'undefined' ? '' : location.href) {
  return readPermalink(input, {schema})
}
