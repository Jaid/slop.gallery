import type {NamedKnotScene, RenderKnotOptions} from 'knot-materials/scripts/renderKnot.ts'

import {parseRenderKnotArgs, renderKnotHelp, renderKnotInScene, sceneFolder} from 'knot-materials/scripts/renderKnot.ts'

import {knottinghamScene} from './lib/knottinghamKnotScene.ts'

const scenes = {
  heavy: {
    description: 'the knot in its own Knottingham room under Heavy graphics, reflecting the gallery’s environment',
    scene: knottinghamScene('heavy'),
  },
  cinematic: {
    description: 'the same under Cinematic graphics',
    scene: knottinghamScene('cinematic'),
  },
} satisfies Record<string, NamedKnotScene>

export type RenderKnotScene = keyof typeof scenes | 'transparent'

/** Renders the knot’s inspection set into out/render/<id> of knot-materials, on a transparent background by default or in one of the Knottingham scenes into out/render/<id>-<scene>. */
const main = (id: string, options: Omit<RenderKnotOptions, 'folder' | 'scene'> & {scene?: RenderKnotScene} = {}) => renderKnotInScene(id, scenes, options)

export default main

if (import.meta.main) {
  const parsed = parseRenderKnotArgs(Bun.argv.slice(2), scenes)
  if (parsed) {
    const {id, ...options} = parsed
    console.log(`Output: out/render/${sceneFolder(id, options.scene)}`)
    await main(id, {
      ...options,
      onFile: filename => console.log(filename),
    })
  } else {
    console.log(renderKnotHelp(scenes))
  }
}
