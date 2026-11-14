import type {ContextMenuItem} from '#component/ContextMenu'
import type {Portrait} from '#src/lib/gallery.ts'
import type {PortraitImageFormat} from '#src/lib/gallery/portraitExport.ts'

import Branch from 'branch-component'
import {useEffect, useState} from 'react'

import ContextMenu from '#component/ContextMenu'
import PortraitCollectionItem from '#component/PortraitCollectionItem'
import artworkThumbnails from '#src/lib/artworkThumbnails.ts'
import {notify, useGallery} from '#src/lib/gallery.ts'
import {copyPortrait, exportPortrait} from '#src/lib/gallery/portraitExport.ts'

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

export type PortraitCollectionProps = {
  /** Called with the id of the work the player left-clicked, spectated or not. */
  onSelect?: (id: string) => void
  /** the id of the work the spectation view is showing, if any */
  selectedId?: string
}

/**
 * Every work in the world as a grid of small images, the default ones and those that arrived since, wherever they hang or lie.
 * Left-clicking one calls `onSelect` with its id, which the pause menu spectates it by. Each has a menu of its own in place of the browser’s context menu, see {@link menuItems}, but a default work the player hasn’t interacted with yet.
 */
export default function PortraitCollection({onSelect, selectedId}: PortraitCollectionProps) {
  const portraits = useGallery(s => s.portraits)
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
        {portraits.map(portrait => <li key={portrait.id} className={css.cell}>
          <PortraitCollectionItem
            menuOpen={portrait === chosen} portrait={portrait} selected={portrait.id === selectedId} onMenu={(x, y) => setMenu({
              id: portrait.id,
              x,
              y,
            })} onSelect={onSelect ? () => onSelect(portrait.id) : undefined}
          />
        </li>)}
      </ul>
    </Branch>
    <Branch if={chosen}><ContextMenu items={menuItems(chosen!)} label={chosen?.interacted ? `Image of “${chosen.title}”` : 'Image of an untouched work'} x={menu?.x ?? 0} y={menu?.y ?? 0} onClose={() => setMenu(null)} /></Branch>
  </section>
}
