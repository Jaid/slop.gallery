import Branch from 'branch-component'
import useGraphicsMode from 'use-graphics-mode'

import Portrait from '#component/Portrait'
import WallDust from '#component/WallDust'
import {useGallery} from '#src/lib/gallery.ts'
import world from '#src/worlds/current.ts'

/** Every artwork of the collection, hung or loose, in whichever world is loaded, and in heavy graphics the dust they knock off their walls as they hang. */
export default function Portraits() {
  const portraits = useGallery(s => s.portraits)
  const isHeavy = useGraphicsMode()
  return <>
    {portraits.filter(p => world.reachesPortrait(p)).map(p => <Portrait key={p.id} portrait={p} />)}
    <Branch if={isHeavy} then={WallDust} />
  </>
}
