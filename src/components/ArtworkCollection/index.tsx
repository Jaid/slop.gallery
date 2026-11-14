import type {ArtworkMenuTarget} from '#component/ArtworkCollectionItem'
import type {ArtworkExportAction} from '#src/lib/gallery/exportArtwork.ts'

import Branch from 'branch-component'
import {useState} from 'react'

import ArtworkCollectionItem from '#component/ArtworkCollectionItem'
import ArtworkContextMenu from '#component/ArtworkContextMenu'
import {notify, useGallery} from '#src/lib/gallery.ts'
import {exportArtwork, useArtworkExport} from '#src/lib/gallery/exportArtwork.ts'

import css from './style.module.sass'

/** The live world collection across every floor, including imports and fusion results, not unused catalog entries. */
export default function ArtworkCollection() {
  const portraits = useGallery(state => state.portraits)
  const [target, setTarget] = useState<ArtworkMenuTarget | null>(null)
  const busy = useArtworkExport(state => state.busy)
  const selected = portraits.find(portrait => portrait.id === target?.id)
  if (target && !selected) {
    // A consumed or removed work must not leave a detached menu anchor behind.
    setTarget(null)
  }
  const act = (action: ArtworkExportAction) => {
    if (!selected || useArtworkExport.getState().busy) {
      return
    }
    target?.anchor.focus({preventScroll: true})
    setTarget(null)
    void exportArtwork(selected, action).then(() => {
      notify(action === 'copy' ? 'Artwork copied as PNG.' : `Artwork exported as ${action === 'png' ? 'PNG' : 'WebP'}.`)
    }).catch(error => {
      notify(action === 'copy' ? 'The artwork could not be copied. Allow clipboard access and try again, or export as PNG.' : 'The artwork could not be exported. Try again once its image is available.')
      console.warn('Artwork export failed:', error)
    })
  }
  return <section className={css.container} aria-busy={busy} aria-labelledby='collection-title' data-testid='artwork-collection'>
    <header className={css.header}><h2 id='collection-title'>Collection</h2><span>{portraits.length} {portraits.length === 1 ? 'artwork' : 'artworks'}</span></header>
    <p className={css.hint}>Explore a work to reveal its story. Right-click to export.</p>
    <Branch if={portraits.length} else={<p className={css.empty}>No artworks yet. Drop an image into the world to start your collection.</p>}>
      <ul className={css.grid} aria-label='World artworks'>
        {portraits.map((portrait, index) => <ArtworkCollectionItem key={portrait.id} index={index} menuOpen={target?.id === portrait.id} portrait={portrait} onMenu={setTarget} />)}
      </ul>
    </Branch>
    <p className={css.status} role='status'>{busy ? 'Preparing image…' : ''}</p>
    <Branch if={target && selected}><ArtworkContextMenu key={target?.id} busy={busy} target={target!} onAction={act} onClose={() => setTarget(null)} /></Branch>
  </section>
}
