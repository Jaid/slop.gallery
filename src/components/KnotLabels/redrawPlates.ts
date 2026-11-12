import type {KnotLabel} from './layout.ts'
import type {Rarity} from 'knot-materials'
import type {Texture} from 'three/webgpu'

import {labelHeight, labelTile, labelWidth} from './layout.ts'

/**
 * Has the faces whose rarity differs from the one the atlas `shows` rasterized anew and lays them over their tiles, so live edits do not rebuild the atlas or its shader.
 * `shows` is kept up to date, also when `rasterize` gives up halfway.
 */
export default async function redrawPlates(atlas: Texture<HTMLCanvasElement>, exhibits: ReadonlyArray<KnotLabel>, ratings: ReadonlyMap<string, Rarity>, shows: Map<string, Rarity>, rasterize: (exhibit: KnotLabel) => Promise<HTMLCanvasElement>) {
  // The atlas’ context is scaled to its resolution, so tiles are placed in logical pixels.
  const context = atlas.image.getContext('2d')!
  for (const [index, exhibit] of exhibits.entries()) {
    const rarity = ratings.get(exhibit.id) ?? exhibit.rarity
    if (shows.get(exhibit.id) === rarity) {
      continue
    }
    const plate = await rasterize({
      ...exhibit,
      rarity,
    })
    const {x, y} = labelTile(index)
    context.drawImage(plate, x, y, labelWidth, labelHeight)
    plate.width = 0
    shows.set(exhibit.id, rarity)
    atlas.needsUpdate = true
  }
}
