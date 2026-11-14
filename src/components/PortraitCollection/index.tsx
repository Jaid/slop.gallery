import type {Portrait} from '#src/lib/gallery.ts'

import clsx from 'clsx'
import {useEffect, useMemo, useState, type MouseEvent} from 'react'

import {notify, useGallery} from '#src/lib/gallery.ts'
import downloadBlob from '#src/lib/downloadBlob.ts'

import css from './style.module.sass'

type ContextMenu = {
  portraitId: string
  x: number
  y: number
}

const toFileName = (title: string) => title.replaceAll(/[\/:*?"<>|]+/gu, '').trim() || 'portrait'

async function loadSourceBlob(source: Blob | string) {
  if (source instanceof Blob) {
    return source
  }
  const response = await fetch(source)
  if (!response.ok) {
    throw new Error('The artwork could not be exported.')
  }
  return response.blob()
}

async function encodeBlob(source: Blob | string, format: 'image/png' | 'image/webp') {
  const blob = await loadSourceBlob(source)
  if (blob.type === format) {
    return blob
  }
  const bitmap = await createImageBitmap(blob)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('The browser could not create an export canvas.')
    }
    context.drawImage(bitmap, 0, 0)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(result => {
        if (result) {
          resolve(result)
        } else {
          reject(new Error('The browser could not encode the image.'))
        }
      }, format, 1)
    })
  } finally {
    bitmap.close()
  }
}

async function exportPortrait(portrait: Portrait, format: 'png' | 'webp') {
  try {
    const blob = await encodeBlob(portrait.source, format === 'png' ? 'image/png' : 'image/webp')
    downloadBlob(blob, `${toFileName(portrait.title)}.${format}`)
  } catch (error) {
    console.error(error)
    notify('The image could not be exported.')
  }
}

async function copyPortraitToClipboard(portrait: Portrait) {
  try {
    const blob = await encodeBlob(portrait.source, 'image/png')
    if (!navigator.clipboard || !window.ClipboardItem) {
      throw new Error('Clipboard access is unavailable.')
    }
    await navigator.clipboard.write([
      new ClipboardItem({
        [blob.type]: blob,
      }),
    ])
  } catch (error) {
    console.error(error)
    notify('The image could not be copied to the clipboard.')
  }
}

export default function PortraitCollection() {
  const portraits = useGallery(state => state.portraits)
  const [hovered, setHovered] = useState<string | null>(null)
  const [menu, setMenu] = useState<ContextMenu | null>(null)
  useEffect(() => {
    if (!menu) {
      return
    }
    const close = () => setMenu(null)
    document.addEventListener('click', close, {capture: true})
    return () => {
      document.removeEventListener('click', close, {capture: true})
    }
  }, [menu])
  const active = portraits.find(portrait => portrait.id === menu?.portraitId) ?? null
  return <aside className={css.container} aria-label='Artwork collection' data-testid='portrait-collection'>
    <div className={css.grid}>
      {portraits.map(portrait => <PortraitCard key={portrait.id} hovered={hovered === portrait.id} onContextMenu={event => {
        event.preventDefault()
        setMenu({
          portraitId: portrait.id,
          x: event.clientX,
          y: event.clientY,
        })
      }} onHover={id => setHovered(id)} portrait={portrait} />)}
    </div>
    {active && menu && <div className={css.menu} role='menu' style={{left: menu.x, top: menu.y}}>
      <button className={css.menuButton} type='button' onClick={async () => {
        setMenu(null)
        await exportPortrait(active, 'png')
      }}>Export to PNG</button>
      <button className={css.menuButton} type='button' onClick={async () => {
        setMenu(null)
        await exportPortrait(active, 'webp')
      }}>Export to WebP</button>
      <button className={css.menuButton} type='button' onClick={async () => {
        setMenu(null)
        await copyPortraitToClipboard(active)
      }}>Copy to clipboard (PNG)</button>
    </div>}
  </aside>
}

function PortraitCard({hovered, onContextMenu, onHover, portrait}: {
  hovered: boolean
  onContextMenu: (event: MouseEvent<HTMLButtonElement>) => void
  onHover: (id: string | null) => void
  portrait: Portrait
}) {
  const image = useMemo(() => {
    if (portrait.source instanceof Blob) {
      return URL.createObjectURL(portrait.source)
    }
    return portrait.source
  }, [portrait.source])
  useEffect(() => () => {
    if (image.startsWith('blob:')) {
      URL.revokeObjectURL(image)
    }
  }, [image])
  return <button className={clsx(css.item, hovered && css.hovered, portrait.interacted && css.interacted)} type='button' onContextMenu={onContextMenu} onMouseEnter={() => onHover(portrait.id)} onMouseLeave={() => onHover(null)} onFocus={() => onHover(portrait.id)} onBlur={() => onHover(null)} aria-label={portrait.title}>
    <img alt={portrait.title} className={css.image} src={image} />
    <span className={css.caption}>{portrait.title}</span>
    {portrait.interacted && hovered && <div className={css.tooltip} role='tooltip'>
      <h3>{portrait.title}</h3>
      <p>{portrait.description}</p>
      <dl className={css.meta}>
        <div><dt>Author</dt><dd>{portrait.creator}</dd></div>
        <div><dt>Year</dt><dd>{portrait.year ?? 'Undated'}</dd></div>
      </dl>
    </div>}
  </button>
}
