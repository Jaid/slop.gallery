import type {FloorMirror} from '#src/worlds/gallery/activations.ts'

import {useEffect} from 'react'

import {useGallery} from '#src/lib/gallery/store.ts'
import {setFloorReflectionHeight} from '#src/lib/materials/FloorMaterial.ts'
import {floorMirror} from '#src/worlds/gallery/activations.ts'
import slopGallery from '#src/worlds/gallery/index.ts'

/** the height of the plane each floor mirror of the gallery mirrors in */
const heights = {
  base: 0,
  lodge: slopGallery.room('lodge').floorY,
  moonfall: slopGallery.room('moonfall').floorY,
} satisfies Record<FloorMirror, number>

/** Mirrors the floors in the plane the fences the player is in name, the ground level’s where none of them names one, see `activations.ts`; floors in the other planes show their plain surface meanwhile. */
export default function GalleryFloorMirror() {
  const mirror = useGallery(state => floorMirror(state.whereabouts))
  useEffect(() => {
    setFloorReflectionHeight(heights[mirror ?? 'base'])
  }, [mirror])
  useEffect(() => () => setFloorReflectionHeight(null), [])
  return null
}
