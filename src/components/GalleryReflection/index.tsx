import type {ReflectionGroup} from '#src/worlds/gallery/activations.ts'

import {useLayoutEffect} from 'react'

import {ceilingMirrorY} from '#src/lib/gallery/moonfall/config.ts'
import {useGallery} from '#src/lib/gallery/store.ts'
import {setReflectionHeight} from '#src/lib/materials/PlanarMirrorMaterial.ts'
import {reflectionGroup} from '#src/worlds/gallery/activations.ts'
import slopGallery from '#src/worlds/gallery/index.ts'

/** the world height of each shared mirror plane, facing up on floors and down in Moonfall */
const heights = {
  ground: 0,
  lodge: slopGallery.room('lodge').floorY,
  moonfall: slopGallery.room('moonfall').floorY + ceilingMirrorY,
} satisfies Record<ReflectionGroup, number>

/** Hands the shared pass to the selected group before drawing; without one every surface shades normally. */
export default function GalleryReflection() {
  const group = useGallery(state => reflectionGroup(state.whereabouts))
  useLayoutEffect(() => {
    setReflectionHeight(group ? heights[group] : null)
    return () => setReflectionHeight(0)
  }, [group])
  return null
}
