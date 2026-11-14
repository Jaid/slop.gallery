import type {Portrait} from '#src/lib/gallery.ts'

import Branch from 'branch-component'
import {useCallback, useId, useState} from 'react'

import css from './style.module.sass'

export type ArtworkMenuTarget = {
  anchor: HTMLButtonElement
  id: string
  x: number
  y: number
}

export default function ArtworkCollectionItem({portrait, index, menuOpen, onMenu}: {
  index: number
  menuOpen: boolean
  onMenu: (target: ArtworkMenuTarget) => void
  portrait: Portrait
}) {
  const tooltip = useId()
  const {source} = portrait
  const [failed, setFailed] = useState<Blob | string>()
  // The thumbnail owns this URL for exactly its mounted lifetime, including StrictMode ref replay.
  const imageRef = useCallback((image: HTMLImageElement | null) => {
    if (!image || typeof source === 'string') {
      return
    }
    const url = URL.createObjectURL(source)
    image.src = url
    return () => URL.revokeObjectURL(url)
  }, [source])
  const label = portrait.interacted ? portrait.title : `Unexplored artwork ${index + 1}`
  const open = (anchor: HTMLButtonElement, x?: number, y?: number) => {
    const rect = anchor.getBoundingClientRect()
    onMenu({
      id: portrait.id,
      anchor,
      x: x ?? rect.left,
      y: y ?? rect.bottom,
    })
  }
  return <li className={css.item} data-artwork={portrait.id} data-tone={portrait.imported ? 'imported' : (portrait.interacted ? 'interacted' : 'untouched')}>
    <button
      className={css.thumbnail} aria-expanded={menuOpen} aria-haspopup='menu' aria-label={label} interestfor={portrait.interacted ? tooltip : undefined} type='button'
      onClick={event => open(event.currentTarget)}
      onContextMenu={event => {
        event.preventDefault()
        open(event.currentTarget, event.clientX || undefined, event.clientY || undefined)
      }}
      onKeyDown={event => {
        if (event.key === 'ContextMenu' || event.shiftKey && event.key === 'F10') {
          event.preventDefault()
          open(event.currentTarget)
        }
      }}
    >
      <Branch if={failed !== source} else={<span className={css.unavailable}>Image unavailable</span>}><img alt='' decoding='async' draggable={false} loading='lazy' src={typeof source === 'string' ? source : undefined} ref={imageRef} onError={() => setFailed(source)} /></Branch>
    </button>
    <Branch if={portrait.interacted}>
      <div
        id={tooltip} className={css.tooltip} popover='hint' role='tooltip' onBeforeToggle={event => {
          if (menuOpen && event.newState === 'open') {
            event.preventDefault()
          }
        }}
      >
        <h3>{portrait.title}</h3>
        <p>{portrait.description}</p>
        <p className={css.byline}>{portrait.creator}<span aria-hidden='true'> · </span>{portrait.year ?? 'Undated'}</p>
      </div>
    </Branch>
  </li>
}
