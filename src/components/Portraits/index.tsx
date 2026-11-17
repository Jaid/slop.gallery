import Branch from 'branch-component'
import useGraphicsMode from 'use-graphics-mode'
import {useShallow} from 'zustand/react/shallow'

import Portrait from '#component/Portrait'
import WallDust from '#component/WallDust'
import {useGallery} from '#src/lib/gallery.ts'
import world from '#src/worlds/current.ts'

/** Every artwork of the collection, hung or loose, in whichever world is loaded, but those hanging in rooms out of its reach, and in heavy graphics the dust they knock off their walls as they hang. */
export default function Portraits() {
  const portraits = useGallery(useShallow(s => (world.reach.limited ? s.portraits.filter(portrait => world.portraitInReach(portrait)) : s.portraits)))
  const isHeavy = useGraphicsMode()
  return <>
    {portraits.map(p => <Portrait key={p.id} portrait={p} />)}
    <Branch if={isHeavy} then={WallDust} />
  </>
}
