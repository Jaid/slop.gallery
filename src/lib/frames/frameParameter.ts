import optis from 'optis'
import readPermalink from 'read-permalink'

/** the ids of every frame there is, in kebab-case, the default first, then those of the rooms and those of the fusion ingredients; `index.ts` holds a frame for each */
export const frameIds = ['classic', 'lobby-travertine', 'lobby-louis', 'vesper-ripple', 'vesper-sgraffito', 'vesper-auricular', 'banquet-perspective', 'banquet-deco', 'banquet-checker', 'antechamber-adam', 'antechamber-sevres', 'sienna-velvet', 'sienna-burl', 'sienna-leather', 'salon-barbizon', 'salon-whistler', 'salon-impressionist', 'forge-meander', 'forge-palette', 'forge-brushes', 'moonfall-meteorite', 'moonfall-orbit', 'moonfall-regolith', 'bastion-strapwork', 'bastion-oak', 'lodge-twig', 'lodge-tramp', 'lodge-charred', 'corridor-kumiko', 'corridor-mission', 'oculus-float', 'oculus-acrylic', 'exhibition-vitrine', 'exhibition-evidence', 'exhibition-containment', 'cell-coffer', 'cell-gilding', 'cell-crate', 'halloween-lantern', 'halloween-ossuary', 'horror-flesh', 'horror-bleeding', 'horror-butcher', 'horror-infested', 'horror-maw', 'horror-coffin', 'spook-maelstrom', 'spook-rift', 'spook-abyss', 'spook-seance', 'paint-marbled', 'paint-canvas'] as const
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
