import {normalizeMeshPattern} from 'capture-session'
import optis from 'optis'
import readPermalink from 'read-permalink'

const wireframeHighlightSchema = optis({
  normalizations: {
    wireframe_highlight: normalizeMeshPattern,
  },
})

/** Read an optional minimatch pattern of the mesh paths whose wireframe stands out from the rest of the scene, like `lobby-fountain`, `lobby-fountain/fountain-*` or `alchemy-machine/{alchemy-machine,alchemy-cannon}` (see `collectMeshPattern` of capture-session). */
export function readWireframeHighlight(input: URL | string = typeof location === 'undefined' ? '' : location.href): string | undefined {
  return readPermalink(input, {schema: wireframeHighlightSchema}).wireframe_highlight
}
