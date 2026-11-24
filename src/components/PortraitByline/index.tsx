import type {Portrait} from '#src/lib/gallery.ts'

import Branch from 'branch-component'

/** Who made a work and when, like “Jane Doe · 1924”, either left out where nobody knows, and nothing at all where both are. */
export default function PortraitByline({className, portrait: {creator, year}}: {
  className?: string
  portrait: Pick<Portrait, 'creator' | 'year'>
}) {
  const dated = year !== undefined
  if (!creator && !dated) {
    return null
  }
  return <p className={className}>
    <Branch if={creator}><span>{creator}</span></Branch>
    <Branch if={creator && dated}><span aria-hidden='true'> · </span></Branch>
    <Branch if={dated}><span>{year}</span></Branch>
  </p>
}
