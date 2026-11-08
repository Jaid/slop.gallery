import type {Portrait, Quat, Vec3} from '#src/lib/gallery/types.ts'

import portraitObjects from '#src/lib/gallery/portraitObjects.ts'
import {useGallery} from '#src/lib/gallery/store.ts'

/** a work of the collection, where it is now */
export type PortraitDump = Pick<Portrait, 'fusing' | 'height' | 'hung' | 'id' | 'pending' | 'title' | 'wallId' | 'width'> & {
  /** the middle of its frame, in world meters: where its body is, or where it hangs or lies before it has one */
  position: Vec3
  /** how it is turned, as a quaternion [x, y, z, w]: its front faces +z and its top +y before it is turned */
  quaternion: Quat
}

/** Every work of the collection, where it is now: hung, lying, flying or held by a fusion; see the `dump_portraits` tool. */
export default function dumpPortraits(): Array<PortraitDump> {
  return useGallery.getState().portraits.map(portrait => {
    const body = portraitObjects.get(portrait.id)?.body
    const translation = body?.translation()
    const rotation = body?.rotation()
    return {
      id: portrait.id,
      title: portrait.title,
      hung: portrait.hung,
      ...portrait.wallId === undefined ? {} : {wallId: portrait.wallId},
      width: portrait.width,
      height: portrait.height,
      ...portrait.fusing ? {fusing: portrait.fusing} : {},
      ...portrait.pending ? {pending: portrait.pending} : {},
      position: translation ? [translation.x, translation.y, translation.z] : portrait.position,
      quaternion: rotation ? [rotation.x, rotation.y, rotation.z, rotation.w] : portrait.orientation ?? [0, Math.sin(portrait.rotation / 2), 0, Math.cos(portrait.rotation / 2)],
    }
  })
}
