import Branch from 'branch-component'

import Portrait from '#component/Portrait'
import WallDust from '#component/WallDust'
import usePortraitsInReach from '#src/lib/gallery/usePortraitsInReach.ts'
import {isHeavyGraphics} from '#src/lib/rendering/graphicsQuality.ts'

/** Every artwork of the collection, hung or loose, in whichever world is loaded, but those hanging in rooms out of its reach, and in heavy graphics the dust they knock off their walls as they hang. */
export default function Portraits() {
  const portraits = usePortraitsInReach()
  return <>
    {portraits.map(p => <Portrait key={p.id} portrait={p} />)}
    <Branch if={isHeavyGraphics} then={WallDust} />
  </>
}
