import type {Portrait} from '#src/lib/gallery.ts'

import {useEffect, useRef} from 'react'

import {cameraPose, useGallery} from '#src/lib/gallery.ts'
import {isLowerPosition, minimapHeading, minimapPortrait, minimapRooms, minimapViewBox} from '#src/lib/gallery/minimap.ts'

import css from './style.module.sass'

export default function GalleryMinimap({lower}: {lower: boolean}) {
  const portraits = useGallery(s => s.portraits)
  const interacted = useGallery(s => s.interacted)
  const current = useGallery(s => s.room)
  const player = useRef<SVGPathElement>(null)
  const markers = useRef(new Map<string, SVGRectElement>)
  useEffect(() => {
    // Read the live camera and rigid bodies without rerendering the menu every frame.
    const attribute = (element: SVGElement, name: string, value: string) => {
      if (element.getAttribute(name) !== value) {
        element.setAttribute(name, value)
      }
    }
    let frame: number
    const update = () => {
      if (player.current) {
        attribute(player.current, 'transform', `translate(${cameraPose.position[0]} ${cameraPose.position[2]}) rotate(${minimapHeading(cameraPose.direction)})`)
        attribute(player.current, 'display', isLowerPosition(useGallery.getState().room, cameraPose.position) === lower ? 'inline' : 'none')
      }
      for (const portrait of portraits) {
        const markerElement = markers.current.get(portrait.id)
        if (!markerElement) {
          continue
        }
        const marker = minimapPortrait(portrait)
        attribute(markerElement, 'transform', `translate(${marker.position[0]} ${marker.position[2]}) rotate(${marker.angle})`)
        attribute(markerElement, 'display', !portrait.reserved && marker.lower === lower ? 'inline' : 'none')
      }
      frame = requestAnimationFrame(update)
    }
    update()
    return () => cancelAnimationFrame(frame)
  }, [lower, portraits])
  return <svg className={css.container} aria-label={lower ? 'Lower gallery minimap' : 'Upper gallery minimap'} role='img' viewBox={minimapViewBox}>
    {/* Each room’s drawings on this floor as they are, placed at the room’s origin, as opaque as the world draws it. */}
    {minimapRooms.filter(room => room.lower === lower).map(room => <g key={room.id} dangerouslySetInnerHTML={{__html: room.markup}} data-room={room.id} opacity={room.opacity(current)} transform={room.transform} />)}
    <g className={css.portraits}>{portraits.map(portrait => {
      const marker = minimapPortrait(portrait)
      return <rect
        key={portrait.id} className={portraitStatusClass(portrait, interacted)} data-portrait={portrait.id} display={!portrait.reserved && marker.lower === lower ? 'inline' : 'none'} height={marker.depth} transform={`translate(${marker.position[0]} ${marker.position[2]}) rotate(${marker.angle})`} width={marker.width} x={-marker.width / 2} y={marker.y} ref={element => {
          if (element) {
            markers.current.set(portrait.id, element)
          } else {
            markers.current.delete(portrait.id)
          }
        }}
      />
    })}</g>
    <path className={css.player} aria-label='Your position' d='M 0 -2.4 L 1.35 1.5 L 0 0.85 L -1.35 1.5 Z' display={isLowerPosition(current, cameraPose.position) === lower ? 'inline' : 'none'} transform={`translate(${cameraPose.position[0]} ${cameraPose.position[2]}) rotate(${minimapHeading(cameraPose.direction)})`} ref={player} />
  </svg>
}

function portraitStatusClass(portrait: Portrait, interacted: ReadonlySet<string>) {
  if (portrait.imported) {
    return css.imported
  }
  if (interacted.has(portrait.id)) {
    return css.interacted
  }
}
