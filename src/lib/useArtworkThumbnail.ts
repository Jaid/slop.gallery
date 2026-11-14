import {useEffect, useState} from 'react'

import artworkThumbnails from './artworkThumbnails.ts'

/** The URL of the small image of an artwork, or undefined while it is still being made or if it can’t be; see `artworkThumbnails`. */
export default function useArtworkThumbnail(source: Blob | string) {
  const [made, setMade] = useState<{
    source: Blob | string
    url: string
  }>()
  useEffect(() => {
    let active = true
    void artworkThumbnails.get(source).then(url => {
      if (active) {
        setMade({
          source,
          url,
        })
      }
    }).catch((error: unknown) => console.warn('Artwork thumbnail could not be made:', source, error))
    return () => {
      active = false
    }
  }, [source])
  // One made earlier shows right away, without a frame in between.
  return made?.source === source ? made.url : artworkThumbnails.peek(source)
}
