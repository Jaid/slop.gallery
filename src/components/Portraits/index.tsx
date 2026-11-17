import Branch from 'branch-component'
import useGraphicsMode from 'use-graphics-mode'

import Portrait from '#component/Portrait'
import WallDust from '#component/WallDust'
import {useGallery} from '#src/lib/gallery.ts'
import {reachedRooms} from '#src/lib/worldReach.ts'
import world from '#src/worlds/current.ts'

/**
 * Every artwork of the collection, hung or loose, in whichever world is loaded, and in heavy graphics the dust they knock off their walls as they hang.
 * A work in a room out of reach under `?world_reach` stays in the collection without a model, like its room: its image never decodes. A work in no room, like one lying in a passage, always builds.
 */
export default function Portraits() {
  const portraits = useGallery(s => s.portraits)
  const isHeavy = useGraphicsMode()
  const reached = reachedRooms()
  const shown = reached ? portraits.filter(portrait => {
    const room = world.portraitRoom(portrait, portrait.position)
    return !room || reached.has(room.id)
  }) : portraits
  return <>
    {shown.map(p => <Portrait key={p.id} portrait={p} />)}
    <Branch if={isHeavy} then={WallDust} />
  </>
}
