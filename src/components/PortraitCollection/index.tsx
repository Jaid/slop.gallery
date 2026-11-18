import type {ContextMenuItem} from '#component/ContextMenu'
import type {Portrait, Vec3} from '#src/lib/gallery.ts'
import type {PortraitImageFormat} from '#src/lib/gallery/portraitExport.ts'

import Branch from 'branch-component'
import {useEffect, useState} from 'react'

import ContextMenu from '#component/ContextMenu'
import PortraitCollectionItem from '#component/PortraitCollectionItem'
import artworkThumbnails from '#src/lib/artworkThumbnails.ts'
import {bodyPose, notify} from '#src/lib/gallery.ts'
import {copyPortrait, exportPortrait} from '#src/lib/gallery/portraitExport.ts'
import {portraitPosition} from '#src/lib/gallery/portraitObjects.ts'
import {usePortraitSpectation} from '#src/lib/gallery/portraitSpectation.ts'
import usePortraitsInReach from '#src/lib/gallery/usePortraitsInReach.ts'
import {perceptualDistance} from '#src/lib/perceptualDistance.ts'

import css from './style.module.sass'

/** What the menu and its messages call a work: by its title only once the player has interacted with it, like its tooltip. */
const called = (portrait: Portrait) => (portrait.interacted ? `“${portrait.title}”` : 'The untouched work')
const save = (portrait: Portrait, format: PortraitImageFormat) => {
  void exportPortrait(portrait, format).catch((error: unknown) => {
    console.warn(`“${portrait.title}” could not be exported.`, error)
    notify(`${called(portrait)} could not be exported.`)
  })
}
const copy = (portrait: Portrait) => {
  void copyPortrait(portrait).then(() => notify(`${called(portrait)} was copied to the clipboard.`), (error: unknown) => {
    console.warn(`“${portrait.title}” could not be copied to the clipboard.`, error)
    notify(`${called(portrait)} could not be copied to the clipboard.`)
  })
}
/** what the menu of a work offers: its image, without its frame, as a file or on the clipboard */
const menuItems = (portrait: Portrait): Array<ContextMenuItem> => [
  {
    id: 'export-png',
    icon: 'download',
    label: 'Export as PNG',
    onSelect: () => save(portrait, 'png'),
  },
  {
    id: 'export-webp',
    icon: 'download',
    label: 'Export as WebP',
    onSelect: () => save(portrait, 'webp'),
  },
  {
    id: 'copy',
    icon: 'copy',
    label: 'Copy to clipboard',
    onSelect: () => copy(portrait),
  },
]

/**
 * Every work in the world as a grid of small images, the default ones and those that arrived since, ordered from nearest to farthest from the player, but excluding those hanging in rooms out of its reach, see `World.reach`, whose images never load.
 * A click on one shows it up close in place of the pause menu’s map and middle, see `PortraitSpectation`, and another click on it puts that view away again.
 * Each has a menu of its own in place of the browser’s context menu, see {@link menuItems}, but a default work the player hasn’t interacted with yet.
 */
export default function PortraitCollection() {
  const portraits = usePortraitsInReach()
  // The pause menu freezes movement. Take the player’s feet on opening, not the camera, which may be looking from somewhere else.
  const [origin] = useState((): Vec3 => {
    const [x, y, z] = bodyPose.center
    return [x, y - bodyPose.height / 2, z]
  })
  const ordered = portraits.map(portrait => ({
    portrait,
    distance: perceptualDistance(origin, portraitPosition(portrait)),
  })).toSorted((a, b) => a.distance - b.distance)
  const spectatedId = usePortraitSpectation(state => state.id)
  const toggleSpectation = usePortraitSpectation(state => state.toggle)
  const [menu, setMenu] = useState<{
    id: string
    x: number
    y: number
  } | null>(null)
  // Works that left, like one a fusion used up, take their thumbnails with them.
  useEffect(() => artworkThumbnails.retain(portraits.map(portrait => portrait.source)), [portraits])
  const chosen = menu ? portraits.find(portrait => portrait.id === menu.id) : undefined
  return <section className={css.container} aria-label='Portrait collection' data-testid='portrait-collection'>
    <Branch if={portraits.length} else={<p className={css.empty}>No works here yet. Drop an image anywhere to bring one in.</p>}>
      <ul className={css.grid}>
        {ordered.map(({portrait}) => <li key={portrait.id} className={css.cell}>
          <PortraitCollectionItem
            menuOpen={portrait === chosen} portrait={portrait} spectated={portrait.id === spectatedId} onMenu={(x, y) => setMenu({
              id: portrait.id,
              x,
              y,
            })} onSpectate={() => toggleSpectation(portrait.id)}
          />
        </li>)}
      </ul>
    </Branch>
    <Branch if={chosen}><ContextMenu items={menuItems(chosen!)} label={chosen?.interacted ? `Image of “${chosen.title}”` : 'Image of an untouched work'} x={menu?.x ?? 0} y={menu?.y ?? 0} onClose={() => setMenu(null)} /></Branch>
  </section>
}
