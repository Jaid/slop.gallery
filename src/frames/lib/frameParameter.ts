import optis from 'optis'
import readPermalink from 'read-permalink'

/** the ids of every frame there is, the default first; `index.ts` holds a frame for each, which lives in the folder of its id */
export const frameIds = ['classic', 'abyss', 'acrylic', 'adam', 'auricular', 'barbizon', 'bleeding', 'brushes', 'burl', 'butcher', 'canvas', 'casing', 'charred', 'checker', 'coffer', 'coffin', 'containment', 'crate', 'deco', 'dichroic', 'evidence', 'flesh', 'float', 'gilding', 'impressionist', 'infested', 'kumiko', 'lantern', 'leather', 'louis', 'maelstrom', 'marbled', 'maw', 'meander', 'meteorite', 'mission', 'oak', 'orbit', 'ossuary', 'palette', 'perspective', 'regolith', 'rift', 'ripple', 'seance', 'sevres', 'sgraffito', 'strapwork', 'tramp', 'travertine', 'twig', 'velvet', 'vitrine', 'whistler'] as const
/** the id of one of the frames */
export type PortraitFrameId = typeof frameIds[number]

const frameSchema = optis({
  defaults: {
    frame: '',
  },
  normalizations: {
    frame(value: unknown): PortraitFrameId | '' {
      return frameIds.find(id => id === value) ?? ''
    },
  },
})

/** Read the `?frame`, the id of a frame every work wears instead of its own, for comparing frames in any room; empty for none or an id no frame has. */
export function readFrame(input: URL | string = typeof location === 'undefined' ? '' : location.href): PortraitFrameId | '' {
  return readPermalink(input, {schema: frameSchema}).frame
}
