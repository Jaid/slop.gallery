import Curio from '#component/Curio'
import {curios} from '#src/lib/gallery/curios/index.ts'
import {isRoomReached} from '#src/lib/worldReach.ts'

export default function Props() {
  return <>
    {/* The pumpkin on the Banquet’s table, the hatchet in the Lodge and the helmet in the Bastion, which steer the flavor the Forge’s alchemy machine gives a Transparent Orb, and the painting set on the Forge’s painter’s table and the palette knife on its side table */}
    {curios.filter(curio => isRoomReached(curio.room)).map(curio => <Curio key={curio.id} curio={curio} />)}
  </>
}
